---
kind: task
title: 权限的规则
---
在 `policy.ts` 中实现 `authorize(user, action, project)`：一个项目管理应用的权限规则。它是一个纯函数，Server Function、Route Handler、数据访问层都用它来判断。规则：

1. `user` 是 `null`（没有登录）：`{ allowed: false, reason: 'unauthenticated' }`；
2. 用户既不是管理员（`role` 是 `'admin'`），也不是项目的所有者（`ownerId`）或者成员（`memberIds`）：`'not-found'`，任何操作都是，包括查看。`id` 按字符串完全相同比较；
3. **管理员和所有者**（所有者的全局角色是什么都一样）：五种操作都可以；但项目已经归档（`archived`）时，只能 `'view'` 和 `'archive'`（取消归档）；
4. **其他成员**：项目已经归档时只能 `'view'`；没有归档时按全局的角色：`'member'` 可以 `'view'`、`'edit'`，`'viewer'` 只能 `'view'`；
5. 不允许的操作：`'forbidden'`。允许时只返回 `{ allowed: true }`。

:::files{role=starter}
```ts file=policy.ts
export type Role = 'admin' | 'member' | 'viewer';
export type User = Readonly<{ id: string; role: Role }>;
export type Project = Readonly<{ id: string; ownerId: string; memberIds: readonly string[]; archived: boolean }>;
export type Action = 'view' | 'edit' | 'delete' | 'archive' | 'invite';
export type Decision = { allowed: true } | { allowed: false; reason: 'unauthenticated' | 'not-found' | 'forbidden' };

/** 决定 user 能不能对 project 做 action */
export function authorize(user: User | null, action: Action, project: Project): Decision {
  // TODO
  return { allowed: true };
}
```
```ts file=main.ts
import { authorize, type Action, type Project, type User } from './policy';

const project: Project = { id: 'p1', ownerId: 'alice', memberIds: ['bob'], archived: false };
const users: (User | null)[] = [null, { id: 'alice', role: 'viewer' }, { id: 'bob', role: 'member' }, { id: 'mallory', role: 'member' }, { id: 'root', role: 'admin' }];
const actions: Action[] = ['view', 'edit', 'delete', 'archive', 'invite'];

for (const user of users) {
  const row = actions.map((action) => {
    const decision = authorize(user, action, project);
    return `${action}:${decision.allowed ? '✓' : decision.reason}`;
  });
  console.log((user?.id ?? '（未登录）').padEnd(8), row.join('  '));
}
```
:::

:::files{role=solution}
```ts file=policy.ts
export type Role = 'admin' | 'member' | 'viewer';
export type User = Readonly<{ id: string; role: Role }>;
export type Project = Readonly<{ id: string; ownerId: string; memberIds: readonly string[]; archived: boolean }>;
export type Action = 'view' | 'edit' | 'delete' | 'archive' | 'invite';
export type Decision = { allowed: true } | { allowed: false; reason: 'unauthenticated' | 'not-found' | 'forbidden' };

const ALLOW: Decision = { allowed: true };
const deny = (reason: 'unauthenticated' | 'not-found' | 'forbidden'): Decision => ({ allowed: false, reason });

/** 成员按全局的角色能做的事（不是所有者） */
const MEMBER_ACTIONS: Readonly<Record<Role, readonly Action[]>> = {
  admin: ['view', 'edit', 'delete', 'archive', 'invite'],
  member: ['view', 'edit'],
  viewer: ['view'],
};

/** 归档的项目只能查看；所有者和管理员还可以取消归档 */
const ARCHIVED_ACTIONS: readonly Action[] = ['view', 'archive'];

/** 决定 user 能不能对 project 做 action */
export function authorize(user: User | null, action: Action, project: Project): Decision {
  if (user === null) return deny('unauthenticated');
  const isAdmin = user.role === 'admin';
  const isOwner = project.ownerId === user.id;
  const isMember = isOwner || project.memberIds.includes(user.id);
  // 和项目无关的人：假装这个项目不存在，不透露它的存在
  if (!isAdmin && !isMember) return deny('not-found');
  if (isAdmin || isOwner) {
    return !project.archived || ARCHIVED_ACTIONS.includes(action) ? ALLOW : deny('forbidden');
  }
  if (project.archived && action !== 'view') return deny('forbidden');
  return MEMBER_ACTIONS[user.role].includes(action) ? ALLOW : deny('forbidden');
}
```
```ts file=main.ts
import { authorize, type Action, type Project, type User } from './policy';

const project: Project = { id: 'p1', ownerId: 'alice', memberIds: ['bob'], archived: false };
const users: (User | null)[] = [null, { id: 'alice', role: 'viewer' }, { id: 'bob', role: 'member' }, { id: 'mallory', role: 'member' }, { id: 'root', role: 'admin' }];
const actions: Action[] = ['view', 'edit', 'delete', 'archive', 'invite'];

for (const user of users) {
  const row = actions.map((action) => {
    const decision = authorize(user, action, project);
    return `${action}:${decision.allowed ? '✓' : decision.reason}`;
  });
  console.log((user?.id ?? '（未登录）').padEnd(8), row.join('  '));
}
```
:::

:::files{role=tests}
```ts file=policy.test.ts
import { describe, expect, test } from 'vitest';
import { authorize, type Action, type Project, type User } from './policy';

const ACTIONS: readonly Action[] = ['view', 'edit', 'delete', 'archive', 'invite'];

const project: Project = { id: 'p1', ownerId: 'alice', memberIds: ['bob', 'carol'], archived: false };
const archived: Project = { ...project, archived: true };

const alice: User = { id: 'alice', role: 'viewer' };
const bob: User = { id: 'bob', role: 'member' };
const carol: User = { id: 'carol', role: 'viewer' };
const admin: User = { id: 'root', role: 'admin' };
const mallory: User = { id: 'mallory', role: 'member' };

/** 每个操作是否允许，按 ACTIONS 的顺序 */
const allowedActions = (user: User | null, p: Project) => ACTIONS.filter((action) => authorize(user, action, p).allowed);

describe('authorize', () => {
  test('没有登录：unauthenticated', () => {
    for (const action of ACTIONS) expect(authorize(null, action, project), action).toStrictEqual({ allowed: false, reason: 'unauthenticated' });
  });

  test('和项目无关的人：not-found，连查看也不行（不透露项目的存在）', () => {
    for (const action of ACTIONS) expect(authorize(mallory, action, project), action).toStrictEqual({ allowed: false, reason: 'not-found' });
    expect(authorize(mallory, 'view', archived)).toStrictEqual({ allowed: false, reason: 'not-found' });
  });

  test('所有者：什么都可以，不管全局的角色是什么', () => {
    expect(allowedActions(alice, project)).toStrictEqual(ACTIONS);
  });

  test('管理员：什么都可以，即使不是成员', () => {
    expect(allowedActions(admin, project)).toStrictEqual(ACTIONS);
  });

  test('成员按全局的角色：member 可以查看和编辑，viewer 只能查看', () => {
    expect(allowedActions(bob, project)).toStrictEqual(['view', 'edit']);
    expect(allowedActions(carol, project)).toStrictEqual(['view']);
    expect(authorize(bob, 'delete', project)).toStrictEqual({ allowed: false, reason: 'forbidden' });
    expect(authorize(carol, 'edit', project)).toStrictEqual({ allowed: false, reason: 'forbidden' });
  });

  test('归档的项目：只能查看；所有者和管理员还可以 archive（取消归档）', () => {
    expect(allowedActions(alice, archived)).toStrictEqual(['view', 'archive']);
    expect(allowedActions(admin, archived)).toStrictEqual(['view', 'archive']);
    expect(allowedActions(bob, archived)).toStrictEqual(['view']);
    expect(authorize(bob, 'edit', archived)).toStrictEqual({ allowed: false, reason: 'forbidden' });
    expect(authorize(alice, 'edit', archived)).toStrictEqual({ allowed: false, reason: 'forbidden' });
  });

  test('只看 id：名字相同的 role 不会让别人变成成员', () => {
    const impostor: User = { id: 'Bob', role: 'member' };
    expect(authorize(impostor, 'view', project)).toStrictEqual({ allowed: false, reason: 'not-found' });
  });

  test('允许时只返回 { allowed: true }', () => {
    expect(authorize(bob, 'view', project)).toStrictEqual({ allowed: true });
  });
});
```
:::

:::hint{level=1}
按规则的顺序写成几个提前返回的 `if`：先没有登录，再无关的人，再管理员和所有者，最后普通的成员。“每种角色能做什么”写成一张表（`Record<Role, Action[]>`），比一串 `if` 更容易检查。
:::

:::hint{level=2}
先算出三个布尔值：`isAdmin`、`isOwner`、`isMember`（所有者也算成员）。归档的规则对两类人不同：管理员和所有者可以 `'view'` 和 `'archive'`，其他成员只能 `'view'`。
:::

:::explanation
认证回答“你是谁”，授权回答“你能做什么”。授权的规则应该集中在一个地方，并且是一个不依赖请求、数据库的纯函数：这样每个需要它的地方（页面上是否显示“删除”按钮、Server Function 是否执行删除、Route Handler 是否返回数据）用的都是同一套规则，规则本身也很容易测试。

对和项目无关的人返回 `'not-found'` 而不是 `'forbidden'`：403 等于告诉他“这个项目存在，只是你看不了”，攻击者可以用它来探测哪些 id 是有效的。h06 的接口中，`'not-found'` 返回 404，`'forbidden'` 返回 403，`'unauthenticated'` 返回 401。

所有者的身份优先于全局的角色，是“关系”决定权限的例子：权限往往不是一个人的属性，而是一个人和一份数据之间的关系。

替代解先把用户和项目的关系归成四类（管理者、编辑者、读者、无关的人），再查两张表（没有归档、已经归档）。
:::

:::variant{kind=alt name=relation-tables}
```ts file=policy.ts
export type Role = 'admin' | 'member' | 'viewer';
export type User = Readonly<{ id: string; role: Role }>;
export type Project = Readonly<{ id: string; ownerId: string; memberIds: readonly string[]; archived: boolean }>;
export type Action = 'view' | 'edit' | 'delete' | 'archive' | 'invite';
export type Decision = { allowed: true } | { allowed: false; reason: 'unauthenticated' | 'not-found' | 'forbidden' };

/** 一个人和这个项目的关系，从大到小 */
type Relation = 'manager' | 'editor' | 'reader' | 'stranger';

function relation(user: User, project: Project): Relation {
  if (user.role === 'admin' || project.ownerId === user.id) return 'manager';
  if (!project.memberIds.includes(user.id)) return 'stranger';
  return user.role === 'member' ? 'editor' : 'reader';
}

/** 每种关系能做的事；归档的项目单独一张表 */
const ACTIVE: Readonly<Record<Exclude<Relation, 'stranger'>, readonly Action[]>> = {
  manager: ['view', 'edit', 'delete', 'archive', 'invite'],
  editor: ['view', 'edit'],
  reader: ['view'],
};
const ARCHIVED: Readonly<Record<Exclude<Relation, 'stranger'>, readonly Action[]>> = {
  manager: ['view', 'archive'],
  editor: ['view'],
  reader: ['view'],
};

/** 决定 user 能不能对 project 做 action */
export function authorize(user: User | null, action: Action, project: Project): Decision {
  if (user === null) return { allowed: false, reason: 'unauthenticated' };
  const who = relation(user, project);
  if (who === 'stranger') return { allowed: false, reason: 'not-found' };
  const table = project.archived ? ARCHIVED : ACTIVE;
  return table[who].includes(action) ? { allowed: true } : { allowed: false, reason: 'forbidden' };
}
```
:::

:::variant{kind=wrong name=forbidden-for-strangers fails=tests reason="对和项目无关的人返回 forbidden：等于告诉他这个项目是存在的"}
```ts file=policy.ts
export type Role = 'admin' | 'member' | 'viewer';
export type User = Readonly<{ id: string; role: Role }>;
export type Project = Readonly<{ id: string; ownerId: string; memberIds: readonly string[]; archived: boolean }>;
export type Action = 'view' | 'edit' | 'delete' | 'archive' | 'invite';
export type Decision = { allowed: true } | { allowed: false; reason: 'unauthenticated' | 'not-found' | 'forbidden' };

const ALLOW: Decision = { allowed: true };
const deny = (reason: 'unauthenticated' | 'not-found' | 'forbidden'): Decision => ({ allowed: false, reason });

/** 成员按全局的角色能做的事（不是所有者） */
const MEMBER_ACTIONS: Readonly<Record<Role, readonly Action[]>> = {
  admin: ['view', 'edit', 'delete', 'archive', 'invite'],
  member: ['view', 'edit'],
  viewer: ['view'],
};

/** 归档的项目只能查看；所有者和管理员还可以取消归档 */
const ARCHIVED_ACTIONS: readonly Action[] = ['view', 'archive'];

/** 决定 user 能不能对 project 做 action */
export function authorize(user: User | null, action: Action, project: Project): Decision {
  if (user === null) return deny('unauthenticated');
  const isAdmin = user.role === 'admin';
  const isOwner = project.ownerId === user.id;
  const isMember = isOwner || project.memberIds.includes(user.id);
  // 和项目无关的人：假装这个项目不存在，不透露它的存在
  if (!isAdmin && !isMember) return deny('forbidden');
  if (isAdmin || isOwner) {
    return !project.archived || ARCHIVED_ACTIONS.includes(action) ? ALLOW : deny('forbidden');
  }
  if (project.archived && action !== 'view') return deny('forbidden');
  return MEMBER_ACTIONS[user.role].includes(action) ? ALLOW : deny('forbidden');
}
```
:::

:::variant{kind=wrong name=strangers-can-view fails=tests reason="让无关的人也能查看：登录了的任何人都能读到别人的项目"}
```ts file=policy.ts
export type Role = 'admin' | 'member' | 'viewer';
export type User = Readonly<{ id: string; role: Role }>;
export type Project = Readonly<{ id: string; ownerId: string; memberIds: readonly string[]; archived: boolean }>;
export type Action = 'view' | 'edit' | 'delete' | 'archive' | 'invite';
export type Decision = { allowed: true } | { allowed: false; reason: 'unauthenticated' | 'not-found' | 'forbidden' };

const ALLOW: Decision = { allowed: true };
const deny = (reason: 'unauthenticated' | 'not-found' | 'forbidden'): Decision => ({ allowed: false, reason });

/** 成员按全局的角色能做的事（不是所有者） */
const MEMBER_ACTIONS: Readonly<Record<Role, readonly Action[]>> = {
  admin: ['view', 'edit', 'delete', 'archive', 'invite'],
  member: ['view', 'edit'],
  viewer: ['view'],
};

/** 归档的项目只能查看；所有者和管理员还可以取消归档 */
const ARCHIVED_ACTIONS: readonly Action[] = ['view', 'archive'];

/** 决定 user 能不能对 project 做 action */
export function authorize(user: User | null, action: Action, project: Project): Decision {
  if (user === null) return deny('unauthenticated');
  const isAdmin = user.role === 'admin';
  const isOwner = project.ownerId === user.id;
  const isMember = isOwner || project.memberIds.includes(user.id);
  // 和项目无关的人：假装这个项目不存在，不透露它的存在
  if (!isAdmin && !isMember) return action === 'view' ? ALLOW : deny('not-found');
  if (isAdmin || isOwner) {
    return !project.archived || ARCHIVED_ACTIONS.includes(action) ? ALLOW : deny('forbidden');
  }
  if (project.archived && action !== 'view') return deny('forbidden');
  return MEMBER_ACTIONS[user.role].includes(action) ? ALLOW : deny('forbidden');
}
```
:::

:::variant{kind=wrong name=role-over-ownership fails=tests reason="全局的角色优先于所有者的身份：全局是 viewer 的所有者不能管理自己的项目"}
```ts file=policy.ts
export type Role = 'admin' | 'member' | 'viewer';
export type User = Readonly<{ id: string; role: Role }>;
export type Project = Readonly<{ id: string; ownerId: string; memberIds: readonly string[]; archived: boolean }>;
export type Action = 'view' | 'edit' | 'delete' | 'archive' | 'invite';
export type Decision = { allowed: true } | { allowed: false; reason: 'unauthenticated' | 'not-found' | 'forbidden' };

const ALLOW: Decision = { allowed: true };
const deny = (reason: 'unauthenticated' | 'not-found' | 'forbidden'): Decision => ({ allowed: false, reason });

/** 成员按全局的角色能做的事（不是所有者） */
const MEMBER_ACTIONS: Readonly<Record<Role, readonly Action[]>> = {
  admin: ['view', 'edit', 'delete', 'archive', 'invite'],
  member: ['view', 'edit'],
  viewer: ['view'],
};

/** 归档的项目只能查看；所有者和管理员还可以取消归档 */
const ARCHIVED_ACTIONS: readonly Action[] = ['view', 'archive'];

/** 决定 user 能不能对 project 做 action */
export function authorize(user: User | null, action: Action, project: Project): Decision {
  if (user === null) return deny('unauthenticated');
  const isAdmin = user.role === 'admin';
  const isOwner = project.ownerId === user.id;
  const isMember = isOwner || project.memberIds.includes(user.id);
  // 和项目无关的人：假装这个项目不存在，不透露它的存在
  if (!isAdmin && !isMember) return deny('not-found');
  if (isAdmin) {
    return !project.archived || ARCHIVED_ACTIONS.includes(action) ? ALLOW : deny('forbidden');
  }
  if (project.archived && action !== 'view') return deny('forbidden');
  return MEMBER_ACTIONS[user.role].includes(action) ? ALLOW : deny('forbidden');
}
```
:::

:::variant{kind=wrong name=archived-ignored fails=tests reason="没有处理归档：归档的项目仍然可以编辑和删除"}
```ts file=policy.ts
export type Role = 'admin' | 'member' | 'viewer';
export type User = Readonly<{ id: string; role: Role }>;
export type Project = Readonly<{ id: string; ownerId: string; memberIds: readonly string[]; archived: boolean }>;
export type Action = 'view' | 'edit' | 'delete' | 'archive' | 'invite';
export type Decision = { allowed: true } | { allowed: false; reason: 'unauthenticated' | 'not-found' | 'forbidden' };

const ALLOW: Decision = { allowed: true };
const deny = (reason: 'unauthenticated' | 'not-found' | 'forbidden'): Decision => ({ allowed: false, reason });

/** 成员按全局的角色能做的事（不是所有者） */
const MEMBER_ACTIONS: Readonly<Record<Role, readonly Action[]>> = {
  admin: ['view', 'edit', 'delete', 'archive', 'invite'],
  member: ['view', 'edit'],
  viewer: ['view'],
};

/** 归档的项目只能查看；所有者和管理员还可以取消归档 */
const ARCHIVED_ACTIONS: readonly Action[] = ['view', 'archive'];

/** 决定 user 能不能对 project 做 action */
export function authorize(user: User | null, action: Action, project: Project): Decision {
  if (user === null) return deny('unauthenticated');
  const isAdmin = user.role === 'admin';
  const isOwner = project.ownerId === user.id;
  const isMember = isOwner || project.memberIds.includes(user.id);
  // 和项目无关的人：假装这个项目不存在，不透露它的存在
  if (!isAdmin && !isMember) return deny('not-found');
  if (isAdmin || isOwner) {
    return ALLOW;
  }
  return MEMBER_ACTIONS[user.role].includes(action) ? ALLOW : deny('forbidden');
}
```
:::

:::variant{kind=wrong name=member-can-delete fails=tests reason="普通成员也可以删除：删除应该只有所有者和管理员才能做"}
```ts file=policy.ts
export type Role = 'admin' | 'member' | 'viewer';
export type User = Readonly<{ id: string; role: Role }>;
export type Project = Readonly<{ id: string; ownerId: string; memberIds: readonly string[]; archived: boolean }>;
export type Action = 'view' | 'edit' | 'delete' | 'archive' | 'invite';
export type Decision = { allowed: true } | { allowed: false; reason: 'unauthenticated' | 'not-found' | 'forbidden' };

const ALLOW: Decision = { allowed: true };
const deny = (reason: 'unauthenticated' | 'not-found' | 'forbidden'): Decision => ({ allowed: false, reason });

/** 成员按全局的角色能做的事（不是所有者） */
const MEMBER_ACTIONS: Readonly<Record<Role, readonly Action[]>> = {
  admin: ['view', 'edit', 'delete', 'archive', 'invite'],
  member: ['view', 'edit', 'delete'],
  viewer: ['view'],
};

/** 归档的项目只能查看；所有者和管理员还可以取消归档 */
const ARCHIVED_ACTIONS: readonly Action[] = ['view', 'archive'];

/** 决定 user 能不能对 project 做 action */
export function authorize(user: User | null, action: Action, project: Project): Decision {
  if (user === null) return deny('unauthenticated');
  const isAdmin = user.role === 'admin';
  const isOwner = project.ownerId === user.id;
  const isMember = isOwner || project.memberIds.includes(user.id);
  // 和项目无关的人：假装这个项目不存在，不透露它的存在
  if (!isAdmin && !isMember) return deny('not-found');
  if (isAdmin || isOwner) {
    return !project.archived || ARCHIVED_ACTIONS.includes(action) ? ALLOW : deny('forbidden');
  }
  if (project.archived && action !== 'view') return deny('forbidden');
  return MEMBER_ACTIONS[user.role].includes(action) ? ALLOW : deny('forbidden');
}
```
:::

:::variant{kind=wrong name=case-insensitive-id fails=tests reason="比较 id 时忽略大小写：Bob 被当成了 bob"}
```ts file=policy.ts
export type Role = 'admin' | 'member' | 'viewer';
export type User = Readonly<{ id: string; role: Role }>;
export type Project = Readonly<{ id: string; ownerId: string; memberIds: readonly string[]; archived: boolean }>;
export type Action = 'view' | 'edit' | 'delete' | 'archive' | 'invite';
export type Decision = { allowed: true } | { allowed: false; reason: 'unauthenticated' | 'not-found' | 'forbidden' };

const ALLOW: Decision = { allowed: true };
const deny = (reason: 'unauthenticated' | 'not-found' | 'forbidden'): Decision => ({ allowed: false, reason });

/** 成员按全局的角色能做的事（不是所有者） */
const MEMBER_ACTIONS: Readonly<Record<Role, readonly Action[]>> = {
  admin: ['view', 'edit', 'delete', 'archive', 'invite'],
  member: ['view', 'edit'],
  viewer: ['view'],
};

/** 归档的项目只能查看；所有者和管理员还可以取消归档 */
const ARCHIVED_ACTIONS: readonly Action[] = ['view', 'archive'];

/** 决定 user 能不能对 project 做 action */
export function authorize(user: User | null, action: Action, project: Project): Decision {
  if (user === null) return deny('unauthenticated');
  const isAdmin = user.role === 'admin';
  const isOwner = project.ownerId === user.id;
  const isMember = isOwner || project.memberIds.some((id) => id.toLowerCase() === user.id.toLowerCase());
  // 和项目无关的人：假装这个项目不存在，不透露它的存在
  if (!isAdmin && !isMember) return deny('not-found');
  if (isAdmin || isOwner) {
    return !project.archived || ARCHIVED_ACTIONS.includes(action) ? ALLOW : deny('forbidden');
  }
  if (project.archived && action !== 'view') return deny('forbidden');
  return MEMBER_ACTIONS[user.role].includes(action) ? ALLOW : deny('forbidden');
}
```
:::

