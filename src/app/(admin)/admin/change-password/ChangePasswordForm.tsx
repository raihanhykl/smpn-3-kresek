'use client';

import { useActionState } from 'react';
import { changePasswordAction, type ChangePasswordState } from './actions';

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Password saat ini" name="currentPassword" />
      <Field label="Password baru (min 8 karakter)" name="newPassword" minLength={8} />
      <Field label="Konfirmasi password baru" name="confirmPassword" minLength={8} />
      {state?.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary px-4 py-2 font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? 'Mengganti...' : 'Ganti Password'}
      </button>
    </form>
  );
}

function Field({ label, name, minLength }: { label: string; name: string; minLength?: number }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-neutral-800">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        required
        minLength={minLength}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
