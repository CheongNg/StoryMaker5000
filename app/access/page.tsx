import { AccessForm } from "./access-form";

type AccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccessPage({ searchParams }: AccessPageProps) {
  const params = (await searchParams) || {};
  const rawReturnTo = stringParam(params.returnTo) || "/";
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/";
  const error = stringParam(params.error);

  return (
    <main className="access-shell">
      <AccessForm error={error} returnTo={returnTo} />
    </main>
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
