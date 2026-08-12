/**
 * Re-exports the shared JWT secret resolver from @7f/config.
 *
 * Moved to @7f/config so apps/worker can use the exact same secret
 * resolution rules when signing its internal service tokens. This file is
 * kept as a re-export (same name, same signature, same import path) so no
 * existing import of `getJwtAccessSecret` from here breaks.
 */
export { getJwtAccessSecret } from '@7f/config';
