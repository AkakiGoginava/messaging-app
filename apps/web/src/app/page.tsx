import { redirect } from 'next/navigation';

/**
 * The application root has no content of its own. It sends visitors to the
 * authenticated destination, which restores the session and falls back to
 * the expired-session screen when there is none.
 */
export default function Home() {
  redirect('/conversations');
}
