-- What the legal expert a matter is shared with says about one document. Several comments, apart
-- from the single verdict. They belong to that file. A replacement file is a new row and starts clean.
-- Deleting a file deletes its comments.
CREATE TABLE IF NOT EXISTS matter_document_comments (
  id          SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES matter_documents(id) ON DELETE CASCADE,
  author_id   INTEGER NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS matter_document_comments_doc_idx ON matter_document_comments (document_id, id);
