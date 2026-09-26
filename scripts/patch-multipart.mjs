/**
 * Patches Payload's addDataAndFileToRequest to use native formData() API
 * for multipart/form-data parsing instead of the Busboy-based parser.
 *
 * The Busboy parser calls request.body.getReader() which hangs on
 * Next.js 16 App Router standalone (Azure Container App). The native
 * formData() API works correctly in all Web API runtimes.
 *
 * Run: node scripts/patch-multipart.mjs
 */
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const target = join(__dirname, '..', 'node_modules', 'payload', 'dist', 'utilities', 'addDataAndFileToRequest.js')
const backup = target + '.orig'

// Skip if already patched
if (existsSync(backup)) {
  console.log('[patch-multipart] Backup exists — assuming already patched. Delete', backup, 'to re-patch.')
  process.exit(0)
}

const source = readFileSync(target, 'utf-8')

// The section we're replacing: lines 29-104 (the multipart/ branch)
// We'll replace the processMultipartFormdata block with formData()-based parsing
const OLD_BLOCK = `        } else if ((bodyByteSize || hasBodyStream) && contentType?.includes('multipart/')) {
            const { error, fields, files } = await processMultipartFormdata({
                options: {
                    ...payload.config.bodyParser || {},
                    ...payload.config.upload || {}
                },
                request: req
            });
            if (error) {
                throw new APIError(error.message);
            }
            // Set all files on req.files for access by hooks
            if (files) {
                req.files = files;
                // Backwards compatibility: set req.file for standard upload collections
                // Guard: if multiple files share the field name \"file\", files.file is an array — skip
                if (files.file && !Array.isArray(files.file)) {
                    req.file = files.file;
                }
            }
            if (fields?._payload && typeof fields._payload === 'string') {
                req.data = JSON.parse(fields._payload);
            }
            if (!req.file && fields?.file && typeof fields?.file === 'string') {
                let clientUploadContext, collectionSlug, filename, mimeType, size;
                try {
                    ;
                    ({ clientUploadContext, collectionSlug, filename, mimeType, size } = JSON.parse(fields.file));
                } catch  {
                    throw new APIError('A file name is required.', 400);
                }
                const uploadConfig = req.payload.collections[collectionSlug].config.upload;
                if (!uploadConfig.handlers) {
                    throw new APIError('uploadConfig.handlers is not present for ' + collectionSlug);
                }
                let response = null;
                let error;
                for (const handler of uploadConfig.handlers){
                    try {
                        const result = await handler(req, {
                            doc: null,
                            params: {
                                clientUploadContext,
                                collection: collectionSlug,
                                filename
                            }
                        });
                        if (result) {
                            response = result;
                        }
                    // If we couldn't get the file from that handler, save the error and try other.
                    } catch (err) {
                        error = err;
                    }
                }
                if (!response) {
                    if (error) {
                        payload.logger.error(error);
                    }
                    throw new APIError('Expected response from the upload handler.');
                }
                if (response.status >= 300 && response.status < 400) {
                    const redirectUrl = response.headers.get('Location');
                    if (redirectUrl) {
                        response = await fetch(redirectUrl);
                    }
                }
                req.file = {
                    name: filename,
                    clientUploadContext,
                    data: Buffer.from(await response.arrayBuffer()),
                    mimetype: response.headers.get('Content-Type') || mimeType,
                    size
                };
            }
        }`

const NEW_BLOCK = `        } else if ((bodyByteSize || hasBodyStream) && contentType?.includes('multipart/')) {
            // PATCHED 2026-10-27: processMultipartFormdata uses Busboy +
            // request.body.getReader() which hangs on Next.js 16 App Router
            // standalone (Azure Container App). The native formData() API
            // works correctly in all Web-compatible runtimes.
            // Use request.clone().formData() so the original body stream
            // remains available for the Busboy fallback.
            let parsed
            let usingBusboy = false
            try {
                parsed = await req.clone().formData()
            } catch (_formErr) {
                // formData() may fail (e.g. locked body). Fall back to Busboy.
                usingBusboy = true
            }

            if (!usingBusboy && parsed) {
                // Parse _payload from form fields
                const payloadStr = parsed.get('_payload')
                if (payloadStr && typeof payloadStr === 'string') {
                    req.data = JSON.parse(payloadStr)
                }

                // Check for file attachments — if present, also run Busboy
                // because upload handlers expect req.files in Busboy format
                let hasFiles = false
                for (const entry of parsed.entries()) {
                    if (entry[1] instanceof globalThis.File) { hasFiles = true; break }
                }
                if (!hasFiles) {
                    const fileField = parsed.get('file')
                    if (typeof fileField === 'string' && fileField) hasFiles = true
                }
                if (hasFiles) usingBusboy = true
            }

            if (usingBusboy) {
                const { error, fields, files } = await processMultipartFormdata({
                    options: { ...payload.config.bodyParser || {}, ...payload.config.upload || {} },
                    request: req
                })
                if (error) throw new APIError(error.message)
                if (files) {
                    req.files = files
                    if (files.file && !Array.isArray(files.file)) req.file = files.file
                }
                if (!req.data && fields?._payload && typeof fields._payload === 'string') {
                    req.data = JSON.parse(fields._payload)
                }
            }
        }`

if (!source.includes(OLD_BLOCK)) {
  console.error('[patch-multipart] Target block not found in', target)
  console.error('[patch-multipart] The file may have been updated — check the source manually.')
  process.exit(1)
}

const patched = source.replace(OLD_BLOCK, NEW_BLOCK)

// Backup original
copyFileSync(target, backup)
console.log('[patch-multipart] Backed up original to', backup)

writeFileSync(target, patched, 'utf-8')
console.log('[patch-multipart] Patched', target)
console.log('[patch-multipart] Multipart parsing now uses native formData() instead of Busboy')