# Database design

The database is PostgreSQL 16. There are 17 tables. They are made by the numbered files in `server/src/migrations/`. This page is drawn from those files.

## The tables and how they connect

```mermaid
erDiagram
    users ||--o{ auth_tokens : "has one-time links"
    users ||--o{ invite_tokens : "creates (admin)"
    users ||--o{ providers : "is the expert behind"
    users ||--o{ matters : owns
    users ||--o{ bookmarks : saves
    users ||--o{ bookings : "requests (signed in)"
    users ||--o{ questions : "asks (signed in)"
    users ||--o{ directory_reviews : "decides (admin)"
    users ||--o{ matter_events : writes
    providers ||--o{ matter_routes : "is the first office of"
    providers ||--o{ bookings : "receives"
    providers ||--o{ matters : "is shared with"
    matter_routes ||--o{ matters : "starts"
    matters ||--o{ matter_events : "has a record of"
    matters ||--o{ reminders : "has"
    document_checklists ||--o{ matters : "is followed by"
    matters ||--o{ matter_documents : "holds"
    matter_documents ||--o{ matter_document_comments : "has"
    users ||--o{ matter_document_comments : "writes (expert)"
    guides ||--o{ bookmarks : "is saved in"

    users {
        int id PK
        text name
        text email UK
        text password_hash
        text role "student, staff, legal_expert, admin"
        timestamptz email_verified_at
        timestamptz deactivated_at
        int session_version "raised to end old sessions"
    }
    auth_tokens {
        int id PK
        int user_id FK
        text token_hash UK "only the hash is kept"
        text purpose "verify_email or reset_password"
        timestamptz expires_at
        timestamptz used_at
    }
    invite_tokens {
        int id PK
        text token_hash UK
        text email
        timestamptz expires_at
        timestamptz used_at
        int created_by FK
    }
    providers {
        int id PK
        int user_id FK "the expert account"
        text name
        text category "lawyer, consultant, organisation"
        text type
        bool is_free
        date last_checked_at
        bool bookable
        text meet_link
        text status "draft, pending_review, published"
        int verified_by FK
        timestamptz verified_at
    }
    matter_routes {
        int id PK
        text matter_type UK
        text title
        int first_forum_id FK
        text legal_basis
        text_array steps
        int deadline_days
        text deadline_runs_from
        text status
        int verified_by FK
    }
    guides {
        int id PK
        text domain
        text title
        text situation
        text law_says
        text your_rights
        text steps
        text get_help
        text source_law
        text status
        int verified_by FK
    }
    directory_reviews {
        int id PK
        text record_type "provider, route, guide"
        int record_id
        int reviewer_id FK
        text decision "verified or returned"
        text comment
    }
    bookings {
        int id PK
        int user_id FK "empty when anonymous"
        text anon_token "hash, empty when signed in"
        int provider_id FK
        timestamptz slot
        text status "requested, accepted, declined, completed"
    }
    questions {
        int id PK
        int user_id FK "empty when anonymous"
        text anon_token "hash, empty when signed in"
        text text
        text answer
        int answered_by FK
        text status "open or answered"
    }
    matters {
        int id PK
        int user_id FK
        int route_id FK
        text title
        date next_due
        text status "open or closed"
        int shared_with FK
    }
    matter_events {
        int id PK
        int matter_id FK
        int author_id FK
        date occurred_on
        text description
    }
    reminders {
        int id PK
        int matter_id FK
        date due_on
        date send_on
        text status "pending, sent, missed, cancelled"
    }
    document_checklists {
        int id PK
        text slug UK
        text title
        jsonb items "the documents a task needs"
        text status "draft, pending_review, published"
        int verified_by FK
    }
    matter_documents {
        int id PK
        int matter_id FK
        text item_key "which checklist item it answers"
        text stored_name UK "random name of the encrypted file"
        text mime "pdf, png or jpeg"
        text review_status "pending, complete, needs_fix, out_of_date"
        int reviewed_by FK
    }
    matter_document_comments {
        int id PK
        int document_id FK
        int author_id FK
        text body
    }
    bookmarks {
        int id PK
        int user_id FK
        int guide_id FK
    }
    emergency_contacts {
        int id PK
        text name
        text contact
        text when_to_use
        int sort_order
    }
```

`users` also has a `pending_email` column that holds a new address until its link is used. `matters` has a `checklist_id` that is cleared if the checklist is deleted, so a checklist can never delete a matter.

`directory_reviews` points at a provider, a route or a guide through `record_type` and `record_id`. It is the log of what each expert decided. `emergency_contacts` stands alone. The urgent help page reads it and falls back to a built-in list if it is empty.

## Rules the database enforces itself

These are written as constraints so that a bug in the code cannot break them.

| Rule | How |
|---|---|
| A published guide, entry, route or checklist always names the person who published it | `CHECK (status <> 'published' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))` on `guides`, `providers`, `matter_routes` and `document_checklists` |
| A booking or a question is either signed in or anonymous, never both and never neither | `CHECK ((user_id IS NULL) <> (anon_token IS NULL))` |
| An anonymous code is unique and only its hash is stored | a unique index on `anon_token` where it is not null |
| An expert cannot accept two bookings at the same time | a unique index on `(provider_id, slot)` where the status is `accepted` |
| Only an entry with an expert account can take bookings | `CHECK (NOT bookable OR user_id IS NOT NULL)` on `providers` |
| A route has both a number of days and what they run from or neither | `CHECK ((deadline_days IS NULL) = (deadline_runs_from IS NULL))` |
| A reminder is never set for after its deadline and "sent" always has a time | `CHECK (send_on <= due_on)` and `CHECK ((status = 'sent') = (sent_at IS NOT NULL))` |
| An answered question always has an answer and an expert | `CHECK ((status = 'answered') = (answer IS NOT NULL AND answered_by IS NOT NULL))` |
| A returned review always has a reason | `CHECK (decision <> 'returned' OR comment IS NOT NULL)` |
| A matter is shared with an office or with nobody | `CHECK ((shared_with IS NULL) = (shared_at IS NULL))` |

## Choices worth knowing

- **Accounts are switched off and never deleted.** Guides and entries keep the name of the expert who checked them. A delete would break that link.
- **Dates are plain dates.** `next_due`, `send_on` and `occurred_on` are `DATE`. The server sends them as `YYYY-MM-DD` text so a deadline in Kigali never shifts a day.
- **Saved guides keep their row** when a guide goes back to draft. The save returns on its own once the guide is verified again.
- **One-time links are stored as hashes.** A database leak cannot be used to open anyone's link.
