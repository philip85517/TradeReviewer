import { notFound } from 'next/navigation';
import { LibraryPreviewEntry } from '../components/library-preview/library-preview';

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  const scenario = params?.scenario;
  return <LibraryPreviewEntry initialSearch={typeof scenario === 'string' ? scenario : ''} />;
}
