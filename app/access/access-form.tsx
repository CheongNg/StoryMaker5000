"use client";

import { FormEvent, useState } from "react";

export function AccessForm({
  error,
  returnTo
}: {
  error?: string;
  returnTo: string;
}) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState(error || "");
  const [busy, setBusy] = useState(false);

  async function submitAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/access/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, returnTo })
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok || data.error) {
        setMessage(data.error || "Access failed.");
        return;
      }

      window.location.assign(returnTo);
    } catch {
      setMessage("Access failed. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      action="/api/access/login"
      className="access-panel"
      method="post"
      onSubmit={submitAccess}
    >
      <div>
        <span className="access-kicker">One-Time Access</span>
        <h1>StoryMaker5000</h1>
      </div>
      <input name="returnTo" type="hidden" value={returnTo} />
      <label className="field-group">
        <span>Access code</span>
        <input
          autoCapitalize="none"
          autoComplete="one-time-code"
          autoFocus
          inputMode="numeric"
          name="code"
          onChange={(event) => setCode(event.target.value)}
          pattern="[0-9]*"
          type="text"
          value={code}
        />
      </label>
      <button className="button primary" disabled={busy} type="submit">
        {busy ? "Continuing" : "Continue"}
      </button>
      {message ? <p className="notice">{message}</p> : null}
    </form>
  );
}
