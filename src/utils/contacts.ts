import type { Member } from '../types'

interface ContactAddress {
  city?: string
  country?: string
}

interface NativeContact {
  name?: string[]
  tel?: string[]
  address?: ContactAddress[]
}

declare global {
  interface Navigator {
    contacts?: {
      select: (
        properties: string[],
        options?: { multiple?: boolean }
      ) => Promise<NativeContact[]>
    }
  }
}

export function isContactsSupported(): boolean {
  return typeof navigator !== 'undefined' && 'contacts' in navigator
}

export async function pickContacts(): Promise<Member[]> {
  if (!isContactsSupported()) return []

  const contacts = await navigator.contacts!.select(['name', 'tel'], {
    multiple: true,
  })

  return contacts
    .filter((c) => c.name && c.name[0])
    .map((c) => ({
      id: crypto.randomUUID(),
      name: (c.name![0] ?? '').trim().slice(0, 50),
      phone: c.tel?.[0]?.trim(),
    }))
}
