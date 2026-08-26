// Superfície mínima que a sonda usa. Só o que o produto realmente precisa —
// medir o bundle inteiro do nostr-tools daria um número que não é o do produto.
import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
export { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent, nip19 };
