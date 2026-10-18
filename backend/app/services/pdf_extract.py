import pymupdf  # PyMuPDF

MAX_PAGES = 200
MAX_TEXT_CHARS = 500_000
MIN_TEXT_CHARS = 20


class PdfError(ValueError):
    """The file cannot be accepted as a readable PDF. The message is safe to show to the user."""


def extract_pdf(data: bytes) -> dict:
    """Validate a PDF and pull out its text. Raises PdfError for unusable files."""
    if not data.startswith(b"%PDF-"):
        raise PdfError("This file is not a valid PDF.")

    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception:
        raise PdfError("The PDF could not be opened. It may be damaged.")

    try:
        if doc.needs_pass:
            raise PdfError("Password-protected PDFs are not supported.")
        if doc.page_count == 0:
            raise PdfError("The PDF has no pages.")
        if doc.page_count > MAX_PAGES:
            raise PdfError(f"The PDF has too many pages (maximum {MAX_PAGES}).")

        try:
            parts = [page.get_text("text") for page in doc]
        except Exception:
            raise PdfError("Text could not be read from this PDF. It may be damaged.")

        pages = doc.page_count
    finally:
        doc.close()

    # PostgreSQL cannot store NUL characters in text columns.
    text = "\n\n".join(parts).replace("\x00", "").strip()
    note = None
    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS]
        note = "Very long document: extracted text was shortened."

    if len(text) < MIN_TEXT_CHARS:
        return {
            "page_count": pages,
            "text": "",
            "status": "no_text",
            "message": "No readable text was found. This may be a scanned document; "
                       "text recognition (OCR) is not enabled yet.",
        }
    return {"page_count": pages, "text": text, "status": "processed", "message": note}
