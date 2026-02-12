
## BUILD - 2026-02-12 14:18

**Prompt:** can you add a user

**Plan:**
To implement the feature of adding a new user, we will modify the Telegram bot code to handle user registration. This involves capturing user input for the name and email, and then invoking a backend API to create the user profile. We will also add necessary checks for user existence and provide feedback to the user through the Telegram bot interface.

**Files:** apps/telegram-bot/src/bot.js, apps/backend/scripts/add_demo_users.js

**Changes:** 1. Update the Telegram bot code to handle user registration requests. 2. Create a function to collect user name and email, and call the backend API for user creation. 3. Modify the add_demo_users script to handle new user data if needed.

