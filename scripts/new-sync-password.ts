/**
 * 生成跨设备同步密码及其 SHA-256 哈希。
 * 密码只打印一次，请自己保存；服务器上只需要设置哈希（环境变量 SYNC_PASSWORD_HASH）。
 */
import { generatePassword, hashPassword } from '../server/auth.ts';

const password = generatePassword();
console.log('同步密码（请妥善保存，只显示这一次）：');
console.log(`  ${password}`);
console.log('');
console.log('服务器环境变量：');
console.log(`  SYNC_PASSWORD_HASH=${hashPassword(password)}`);
