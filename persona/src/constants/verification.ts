// Domain verification: how a relying party proves it is served from where it
// says it is.
//
// The method is a file at a well-known path, not a DNS TXT record. DNS is the
// other standard way and is stronger — it proves control of the zone rather
// than of one web server — but this project's own relying parties live on
// `*.up.railway.app`, a zone nobody here controls, so a DNS method could not be
// demonstrated end to end. That constraint is worth stating rather than
// designing around.
export const CHALLENGE_PATH = '/.well-known/persona-challenge.txt';

// 32 random bytes. Long enough that serving the file by accident is not a
// thing that happens.
export const CHALLENGE_BYTES = 32;

// How long a developer has to put the file in place.
export const CHALLENGE_TTL_MS = 24 * 60 * 60 * 1000;

export const CHALLENGE_TIMEOUT_MS = 5_000;

// The file holds one token. Anything larger is not the file being asked for.
export const CHALLENGE_MAX_BYTES = 1_024;
