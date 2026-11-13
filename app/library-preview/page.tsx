import { notFound } from 'next/navigation';
import { LibraryPreviewEntry } from '../components/library-preview/library-preview';

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) query.set(key, first);
  }
  return <LibraryPreviewEntry initialSearch={query.toString()} />;
}
