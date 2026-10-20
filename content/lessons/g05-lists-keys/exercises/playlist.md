---
kind: challenge
title: 播放列表
---
`SongRow`（已经写好）显示一首歌，并用自己的 state 记住是否“喜欢”。完成 `Playlist`：

1. 用 `initialSongs` 作为 state 的初始值，用 `<ol aria-label="播放列表">` 渲染，每首歌一个 `SongRow`；
2. `isFirst` 告诉 `SongRow` 这是不是第一首（第一首的“上移”按钮禁用）；
3. `onMoveUp(id)`：这首歌和前一首交换位置；`onRemove(id)`：删除这首歌；
4. 列表为空时只显示 `<p>播放列表是空的。</p>`；
5. 上移、删除之后，每首歌的“喜欢”状态都要跟着这首歌走。

注意：不同的歌可能同名（预览中就有两首《晴天》）。

:::files{role=starter}
```tsx file=Playlist.tsx
import { useState } from 'react';

export type Song = { id: string; title: string; artist: string };

type SongRowProps = {
  song: Song;
  isFirst: boolean;
  onMoveUp: (id: string) => void;
  onRemove: (id: string) => void;
};

function SongRow({ song, isFirst, onMoveUp, onRemove }: SongRowProps) {
  const [liked, setLiked] = useState(false);
  return (
    <li>
      <span>
        {song.title} - {song.artist}
      </span>{' '}
      <button type="button" aria-pressed={liked} aria-label={`喜欢“${song.title}”`} onClick={() => setLiked(!liked)}>
        {liked ? '♥' : '♡'}
      </button>
      <button type="button" aria-label={`上移“${song.title}”`} disabled={isFirst} onClick={() => onMoveUp(song.id)}>
        ↑
      </button>
      <button type="button" aria-label={`删除“${song.title}”`} onClick={() => onRemove(song.id)}>
        ×
      </button>
    </li>
  );
}

export function Playlist({ initialSongs }: { initialSongs: readonly Song[] }) {
  const [songs, setSongs] = useState(initialSongs);

  // TODO：上移、删除，用 SongRow 渲染每一首歌，处理空列表
  return <ol aria-label="播放列表"></ol>;
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { Playlist, type Song } from './Playlist';

const songs: Song[] = [
  { id: 's1', title: '晴天', artist: '周杰伦' },
  { id: 's2', title: '平凡之路', artist: '朴树' },
  { id: 's3', title: '夜空中最亮的星', artist: '逃跑计划' },
  { id: 's4', title: '晴天', artist: '孙燕姿' },
];

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<Playlist initialSongs={songs} />);
```
:::

:::files{role=solution}
```tsx file=Playlist.tsx
import { useState } from 'react';

export type Song = { id: string; title: string; artist: string };

type SongRowProps = {
  song: Song;
  isFirst: boolean;
  onMoveUp: (id: string) => void;
  onRemove: (id: string) => void;
};

function SongRow({ song, isFirst, onMoveUp, onRemove }: SongRowProps) {
  const [liked, setLiked] = useState(false);
  return (
    <li>
      <span>
        {song.title} - {song.artist}
      </span>{' '}
      <button type="button" aria-pressed={liked} aria-label={`喜欢“${song.title}”`} onClick={() => setLiked(!liked)}>
        {liked ? '♥' : '♡'}
      </button>
      <button type="button" aria-label={`上移“${song.title}”`} disabled={isFirst} onClick={() => onMoveUp(song.id)}>
        ↑
      </button>
      <button type="button" aria-label={`删除“${song.title}”`} onClick={() => onRemove(song.id)}>
        ×
      </button>
    </li>
  );
}

export function Playlist({ initialSongs }: { initialSongs: readonly Song[] }) {
  const [songs, setSongs] = useState(initialSongs);

  function moveUp(id: string) {
    const index = songs.findIndex((s) => s.id === id);
    const previous = songs[index - 1];
    const current = songs[index];
    if (previous === undefined || current === undefined) return;
    setSongs(songs.with(index - 1, current).with(index, previous));
  }

  function remove(id: string) {
    setSongs(songs.filter((s) => s.id !== id));
  }

  if (songs.length === 0) return <p>播放列表是空的。</p>;

  return (
    <ol aria-label="播放列表">
      {songs.map((song, index) => (
        <SongRow key={song.id} song={song} isFirst={index === 0} onMoveUp={moveUp} onRemove={remove} />
      ))}
    </ol>
  );
}
```
:::

:::files{role=tests}
```tsx file=Playlist.test.tsx
import { expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Playlist, type Song } from './Playlist';

const songs: readonly Song[] = Object.freeze([
  { id: 's1', title: '晴天', artist: '周杰伦' },
  { id: 's2', title: '平凡之路', artist: '朴树' },
  { id: 's3', title: '夜空中最亮的星', artist: '逃跑计划' },
]);

function titles(): string[] {
  return within(screen.getByRole('list', { name: '播放列表' }))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('span')?.textContent ?? '');
}

const like = (title: string) => screen.getByRole('button', { name: `喜欢“${title}”` });

test('按顺序显示歌曲，第一首不能上移', () => {
  render(<Playlist initialSongs={songs} />);
  expect(titles()).toEqual(['晴天 - 周杰伦', '平凡之路 - 朴树', '夜空中最亮的星 - 逃跑计划']);
  expect(screen.getByRole('button', { name: '上移“晴天”' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '上移“平凡之路”' })).toBeEnabled();
});

test('删除前面的歌曲之后，“喜欢”仍然跟着原来的歌', async () => {
  const user = userEvent.setup();
  render(<Playlist initialSongs={songs} />);
  await user.click(like('平凡之路'));
  await user.click(screen.getByRole('button', { name: '删除“晴天”' }));
  expect(titles()).toEqual(['平凡之路 - 朴树', '夜空中最亮的星 - 逃跑计划']);
  expect(like('平凡之路')).toHaveAttribute('aria-pressed', 'true');
  expect(like('夜空中最亮的星')).toHaveAttribute('aria-pressed', 'false');
});

test('上移之后，“喜欢”仍然跟着原来的歌', async () => {
  const user = userEvent.setup();
  render(<Playlist initialSongs={songs} />);
  await user.click(like('夜空中最亮的星'));
  await user.click(screen.getByRole('button', { name: '上移“夜空中最亮的星”' }));
  expect(titles()).toEqual(['晴天 - 周杰伦', '夜空中最亮的星 - 逃跑计划', '平凡之路 - 朴树']);
  expect(like('夜空中最亮的星')).toHaveAttribute('aria-pressed', 'true');
  expect(like('平凡之路')).toHaveAttribute('aria-pressed', 'false');
  await user.click(screen.getByRole('button', { name: '上移“夜空中最亮的星”' }));
  expect(titles()[0]).toBe('夜空中最亮的星 - 逃跑计划');
  expect(like('夜空中最亮的星')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '上移“夜空中最亮的星”' })).toBeDisabled();
});

test('其他歌曲的状态在每次操作后都保留', async () => {
  const user = userEvent.setup();
  render(<Playlist initialSongs={songs} />);
  await user.click(like('晴天'));
  await user.click(screen.getByRole('button', { name: '上移“夜空中最亮的星”' }));
  await user.click(screen.getByRole('button', { name: '删除“平凡之路”' }));
  expect(like('晴天')).toHaveAttribute('aria-pressed', 'true');
  expect(like('夜空中最亮的星')).toHaveAttribute('aria-pressed', 'false');
});

test('全部删除后显示空列表的提示', async () => {
  const user = userEvent.setup();
  render(<Playlist initialSongs={songs} />);
  for (const song of songs) await user.click(screen.getByRole('button', { name: `删除“${song.title}”` }));
  expect(screen.getByText('播放列表是空的。')).toBeInTheDocument();
  expect(screen.queryByRole('list')).toBeNull();
});
```
:::

:::hint{level=1}
`songs.map((song, index) => <SongRow key={…} song={song} isFirst={index === 0} onMoveUp={moveUp} onRemove={remove} />)`。key 选什么，决定了 `SongRow` 内部的 state 跟着谁走。
:::

:::hint{level=2}
key 用 `song.id`。上移：用 `findIndex` 找到位置，再用两次 `with` 交换（和 g04 的练习一样）；删除：`filter`。不要用下标（删除和上移都会改变下标），也不要用标题（可能重名）。
:::

:::explanation
“喜欢”是 `SongRow` 自己的 state。React 把这个 state 保存在组件在树中的“位置”上，而 key 决定了位置的身份。key 用 `song.id`，删除或上移之后，React 按 id 找回原来的组件，state 跟着歌走；key 用下标，React 只看位置，第 2 行的 state 就留在了第 2 行，不管这里现在显示的是哪首歌。

用 `` `${index}-${song.id}` `` 这样“组合”的 key 也不行：只要下标变了，key 就变了，React 认为这是一首新歌，旧的组件被销毁，state 全部丢失。`crypto.randomUUID()` 更糟糕，每次渲染都会重建所有行。

另一种设计是把“喜欢”提升到 `Playlist` 中，存成一个 id 的集合（g07 讲状态提升）。那样 state 跟着数据走，不依赖组件的位置；但列表中的组件有自己的 state 是很常见的（例如每一行的展开状态、编辑框），所以 key 必须选对。
:::

:::variant{kind=alt name=updater-functions}
```tsx file=Playlist.tsx
import { useState } from 'react';

export type Song = { id: string; title: string; artist: string };

type SongRowProps = {
  song: Song;
  isFirst: boolean;
  onMoveUp: (id: string) => void;
  onRemove: (id: string) => void;
};

function SongRow({ song, isFirst, onMoveUp, onRemove }: SongRowProps) {
  const [liked, setLiked] = useState(false);
  return (
    <li>
      <span>
        {song.title} - {song.artist}
      </span>{' '}
      <button type="button" aria-pressed={liked} aria-label={`喜欢“${song.title}”`} onClick={() => setLiked(!liked)}>
        {liked ? '♥' : '♡'}
      </button>
      <button type="button" aria-label={`上移“${song.title}”`} disabled={isFirst} onClick={() => onMoveUp(song.id)}>
        ↑
      </button>
      <button type="button" aria-label={`删除“${song.title}”`} onClick={() => onRemove(song.id)}>
        ×
      </button>
    </li>
  );
}

export function Playlist({ initialSongs }: { initialSongs: readonly Song[] }) {
  const [songs, setSongs] = useState<readonly Song[]>(initialSongs);

  const moveUp = (id: string) =>
    setSongs((current) => {
      const index = current.findIndex((s) => s.id === id);
      if (index < 1) return current;
      return [...current.slice(0, index - 1), ...current.slice(index - 1, index + 1).toReversed(), ...current.slice(index + 1)];
    });
  const remove = (id: string) => setSongs((current) => current.filter((s) => s.id !== id));

  return songs.length === 0 ? (
    <p>播放列表是空的。</p>
  ) : (
    <ol aria-label="播放列表">
      {songs.map((song) => (
        <SongRow key={song.id} song={song} isFirst={song === songs[0]} onMoveUp={moveUp} onRemove={remove} />
      ))}
    </ol>
  );
}
```
:::

:::variant{kind=wrong name=index-key fails=tests reason="用下标作 key，删除和上移后“喜欢”留在了原来的位置"}
```tsx file=Playlist.tsx
import { useState } from 'react';

export type Song = { id: string; title: string; artist: string };

type SongRowProps = {
  song: Song;
  isFirst: boolean;
  onMoveUp: (id: string) => void;
  onRemove: (id: string) => void;
};

function SongRow({ song, isFirst, onMoveUp, onRemove }: SongRowProps) {
  const [liked, setLiked] = useState(false);
  return (
    <li>
      <span>
        {song.title} - {song.artist}
      </span>{' '}
      <button type="button" aria-pressed={liked} aria-label={`喜欢“${song.title}”`} onClick={() => setLiked(!liked)}>
        {liked ? '♥' : '♡'}
      </button>
      <button type="button" aria-label={`上移“${song.title}”`} disabled={isFirst} onClick={() => onMoveUp(song.id)}>
        ↑
      </button>
      <button type="button" aria-label={`删除“${song.title}”`} onClick={() => onRemove(song.id)}>
        ×
      </button>
    </li>
  );
}

export function Playlist({ initialSongs }: { initialSongs: readonly Song[] }) {
  const [songs, setSongs] = useState(initialSongs);

  function moveUp(id: string) {
    const index = songs.findIndex((s) => s.id === id);
    const previous = songs[index - 1];
    const current = songs[index];
    if (previous === undefined || current === undefined) return;
    setSongs(songs.with(index - 1, current).with(index, previous));
  }

  function remove(id: string) {
    setSongs(songs.filter((s) => s.id !== id));
  }

  if (songs.length === 0) return <p>播放列表是空的。</p>;

  return (
    <ol aria-label="播放列表">
      {songs.map((song, index) => (
        <SongRow key={index} song={song} isFirst={index === 0} onMoveUp={moveUp} onRemove={remove} />
      ))}
    </ol>
  );
}
```
:::

:::variant{kind=wrong name=index-in-key fails=tests reason="key 中包含下标，位置一变，组件就被重建，state 丢失"}
```tsx file=Playlist.tsx
import { useState } from 'react';

export type Song = { id: string; title: string; artist: string };

type SongRowProps = {
  song: Song;
  isFirst: boolean;
  onMoveUp: (id: string) => void;
  onRemove: (id: string) => void;
};

function SongRow({ song, isFirst, onMoveUp, onRemove }: SongRowProps) {
  const [liked, setLiked] = useState(false);
  return (
    <li>
      <span>
        {song.title} - {song.artist}
      </span>{' '}
      <button type="button" aria-pressed={liked} aria-label={`喜欢“${song.title}”`} onClick={() => setLiked(!liked)}>
        {liked ? '♥' : '♡'}
      </button>
      <button type="button" aria-label={`上移“${song.title}”`} disabled={isFirst} onClick={() => onMoveUp(song.id)}>
        ↑
      </button>
      <button type="button" aria-label={`删除“${song.title}”`} onClick={() => onRemove(song.id)}>
        ×
      </button>
    </li>
  );
}

export function Playlist({ initialSongs }: { initialSongs: readonly Song[] }) {
  const [songs, setSongs] = useState(initialSongs);

  function moveUp(id: string) {
    const index = songs.findIndex((s) => s.id === id);
    const previous = songs[index - 1];
    const current = songs[index];
    if (previous === undefined || current === undefined) return;
    setSongs(songs.with(index - 1, current).with(index, previous));
  }

  function remove(id: string) {
    setSongs(songs.filter((s) => s.id !== id));
  }

  if (songs.length === 0) return <p>播放列表是空的。</p>;

  return (
    <ol aria-label="播放列表">
      {songs.map((song, index) => (
        <SongRow key={`${index}-${song.id}`} song={song} isFirst={index === 0} onMoveUp={moveUp} onRemove={remove} />
      ))}
    </ol>
  );
}
```
:::

:::variant{kind=wrong name=random-key fails=tests reason="每次渲染都生成随机的 key，所有的 state 都会丢失"}
```tsx file=Playlist.tsx
import { useState } from 'react';

export type Song = { id: string; title: string; artist: string };

type SongRowProps = {
  song: Song;
  isFirst: boolean;
  onMoveUp: (id: string) => void;
  onRemove: (id: string) => void;
};

function SongRow({ song, isFirst, onMoveUp, onRemove }: SongRowProps) {
  const [liked, setLiked] = useState(false);
  return (
    <li>
      <span>
        {song.title} - {song.artist}
      </span>{' '}
      <button type="button" aria-pressed={liked} aria-label={`喜欢“${song.title}”`} onClick={() => setLiked(!liked)}>
        {liked ? '♥' : '♡'}
      </button>
      <button type="button" aria-label={`上移“${song.title}”`} disabled={isFirst} onClick={() => onMoveUp(song.id)}>
        ↑
      </button>
      <button type="button" aria-label={`删除“${song.title}”`} onClick={() => onRemove(song.id)}>
        ×
      </button>
    </li>
  );
}

export function Playlist({ initialSongs }: { initialSongs: readonly Song[] }) {
  const [songs, setSongs] = useState(initialSongs);

  function moveUp(id: string) {
    const index = songs.findIndex((s) => s.id === id);
    const previous = songs[index - 1];
    const current = songs[index];
    if (previous === undefined || current === undefined) return;
    setSongs(songs.with(index - 1, current).with(index, previous));
  }

  function remove(id: string) {
    setSongs(songs.filter((s) => s.id !== id));
  }

  if (songs.length === 0) return <p>播放列表是空的。</p>;

  return (
    <ol aria-label="播放列表">
      {songs.map((song, index) => (
        <SongRow key={crypto.randomUUID()} song={song} isFirst={index === 0} onMoveUp={moveUp} onRemove={remove} />
      ))}
    </ol>
  );
}
```
:::
