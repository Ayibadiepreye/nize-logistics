import { customAlphabet } from 'nanoid';
import { nanoid } from 'nanoid';

// Generate ticket ID: NIZ-XXXXXX (6 alphanumeric chars)
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const generateId = customAlphabet(alphabet, 6);

export function generateTicketId() {
  return `NIZ-${generateId()}`;
}

// Generate recipient token (URL-safe)
export function generateRecipientToken() {
  return nanoid(32);
}
