
## BUILD - 2026-02-12 08:50

**Prompt:** can you add a PR for creating some dummy users?

**Plan:**
We will implement a feature to create dummy users by adding a new script in the backend that can be executed to insert predefined user data into the database. This script will check if each user already exists to avoid duplicates and will log the results of the operation.

**Files:** apps/backend/scripts/add_demo_users.js

**Changes:** Added a script to create dummy users with predefined data, checking for existing users to prevent duplicates.

