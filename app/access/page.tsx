import { AccessForm } from "./access-form";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { shouldRequireAccess } from "../../lib/access";

type AccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccessPage({ searchParams }: AccessPageProps) {
  const params = (await searchParams) || {};
  const rawReturnTo = stringParam(params.returnTo) || "/";
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/";
  const error = stringParam(params.error);

  if (!shouldRequireAccess({ headers: await headers() })) {
    redirect(returnTo);
  }

  return (
    <main className="access-shell">
      <AccessForm error={error} returnTo={returnTo} />
    </main>
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
