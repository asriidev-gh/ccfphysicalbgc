"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Select } from "@/components/ui";
import { setAwardeeAction } from "@/app/actions/awards";

/** Pick anyone eligible (the top-voted list covers the usual case; this covers a judges' override). */
export function AwardeePicker({
  eventId,
  category,
  eligible,
}: {
  eventId: string;
  category: string;
  eligible: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <div className="flex gap-2">
        <Select aria-label="Choose any eligible participant" value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">Choose anyone eligible…</option>
          {eligible.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="secondary"
          disabled={!value || pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await setAwardeeAction(eventId, category, value);
              if (!r.ok) setError(r.error);
              else {
                setValue("");
                router.refresh();
              }
            })
          }
        >
          Declare
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-bad mt-1 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
