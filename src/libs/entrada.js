// Superfície mínima que o produto usa. Só o que ele realmente precisa —
// medir o bundle inteiro do nostr-tools daria um número que não é o do produto.
// 2026-09-12 (Etapa 1 dos Contatos): entram NIP-17/59/44 (as
// mensagens privadas) e o `makeAuthEvent` da NIP-42 (identificar-se ao relay
// da caixa de entrada). O `nip44` tem de ser exportado EXPLICITAMENTE: o
// `nip59` o usa por dentro e não o reexporta (armadilha 4 da Etapa 0).
import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import * as nip17 from 'nostr-tools/nip17';
import * as nip59 from 'nostr-tools/nip59';
import * as nip44 from 'nostr-tools/nip44';
import { makeAuthEvent } from 'nostr-tools/nip42';
export { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent, nip19, nip17, nip59, nip44, makeAuthEvent };
