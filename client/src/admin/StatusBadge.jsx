import { useA } from './useA.js';

/** Status is always written in words as well as colour, so it can be read without seeing colours. */
export function StatusBadge({ status }) {
  const { a } = useA();
  return <span className={`badge badge--${status}`}>{a(`status.${status}`)}</span>;
}
