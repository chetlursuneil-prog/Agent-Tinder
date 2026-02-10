const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

// AI Agent class
class AIAgent {
  constructor(name, email, skills, about, price, personality = 'friendly') {
    this.name = name;
    this.email = email;
    this.skills = skills;
    this.about = about;
    this.price = price;
    this.personality = personality;
    this.userId = null;
    this.profileId = null;
    this.token = 'stub-token'; // Since auth is stubbed
  }

  async signup() {
    try {
      const res = await axios.post(`${API_BASE}/auth/signup`, {
        email: this.email,
        name: this.name
      });
      this.userId = res.data.id;
      console.log(`AI Agent ${this.name} signed up with userId: ${this.userId}`);
      return res.data;
    } catch (err) {
      console.error(`Signup failed for ${this.name}:`, err.message);
      throw err;
    }
  }

  async createProfile() {
    try {
      const res = await axios.post(`${API_BASE}/profiles`, {
        userId: this.userId,
        skills: this.skills,
        about: this.about,
        price: this.price
      });
      this.profileId = res.data.id;
      console.log(`AI Agent ${this.name} created profile: ${this.profileId}`);
      return res.data;
    } catch (err) {
      console.error(`Profile creation failed for ${this.name}:`, err.message);
      throw err;
    }
  }

  async getProfilesToSwipe() {
    try {
      const res = await axios.get(`${API_BASE}/profiles`);
      const allProfiles = res.data;
      
      // Get existing matches for this agent
      const matchesRes = await axios.get(`${API_BASE}/matches`);
      const matches = matchesRes.data;
      
      // Find profiles already matched with this agent
      const matchedProfileIds = new Set();
      for (const match of matches) {
        if (match.a === this.profileId) {
          matchedProfileIds.add(match.b);
        }
        if (match.b === this.profileId) {
          matchedProfileIds.add(match.a);
        }
      }
      
      // Exclude own profile, already matched profiles, and other AI agent profiles
      const aiNames = ['AI Assistant', 'Data Analyst', 'Web Developer', 'DevOps Engineer'];
      const profiles = allProfiles.filter(p => 
        p.id !== this.profileId && 
        !matchedProfileIds.has(p.id) &&
        !aiNames.includes(p.name)
      );
      return profiles;
    } catch (err) {
      console.error(`Get profiles failed for ${this.name}:`, err.message);
      return [];
    }
  }

  async swipe(profileId) {
    try {
      // Simple logic: swipe right (create match) if skills match or random
      const shouldMatch = Math.random() > 0.5; // 50% chance for demo
      if (shouldMatch) {
        const res = await axios.post(`${API_BASE}/matches`, {
          a: this.profileId,
          b: profileId
        });
        if (res.status === 201 || (res.data && res.data.id)) {
          console.log(`AI Agent ${this.name} matched with profile ${profileId}`);
        } else if (res.status === 202 || (res.data && res.data.liked)) {
          console.log(`AI Agent ${this.name} liked profile ${profileId}`);
        }
        return res.data;
      }
    } catch (err) {
      console.error(`Swipe failed for ${this.name}:`, err.message);
    }
  }

  async getConversations() {
    try {
      const res = await axios.get(`${API_BASE}/conversations/${this.userId}`);
      return res.data;
    } catch (err) {
      console.error(`Get conversations failed for ${this.name}:`, err.message);
      return [];
    }
  }

  async getMessages(matchId) {
    try {
      const res = await axios.get(`${API_BASE}/messages/${matchId}`);
      return res.data;
    } catch (err) {
      console.error(`Get messages failed for ${this.name}:`, err.message);
      return [];
    }
  }

  async sendMessage(matchId, text) {
    try {
      const res = await axios.post(`${API_BASE}/messages`, {
        matchId,
        fromUserId: this.userId,
        text
      });
      console.log(`AI Agent ${this.name} sent message: "${text}"`);
      return res.data;
    } catch (err) {
      console.error(`Send message failed for ${this.name}:`, err.message);
    }
  }

  async generateResponse(conversationHistory) {
    // Placeholder for LLM integration
    // Replace with actual LLM call (e.g., OpenAI, Claude)
    const prompts = {
      friendly: [
        "Hi! I'm excited to work with you. What are your project details?",
        "That sounds interesting! I have experience in similar areas.",
        "Let's discuss the terms. I'm flexible with pricing.",
        "Great, I'm available to start soon. What's your timeline?"
      ],
      professional: [
        "Hello. Please provide more details about the project requirements.",
        "I have relevant skills for this. My rate is competitive.",
        "I can deliver within your timeframe. Shall we proceed?",
        "Thank you for the opportunity. Looking forward to collaborating."
      ]
    };

    const responses = prompts[this.personality] || prompts.friendly;
    return responses[Math.floor(Math.random() * responses.length)];
  }

  async checkAndRespond() {
    const conversations = await this.getConversations();
    for (const conv of conversations) {
      if (conv.unread_count > 0) {
        const messages = await this.getMessages(conv.match_id);
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.from_user_id !== this.userId) {
          // Generate response
          const response = await this.generateResponse(messages);
          await this.sendMessage(conv.match_id, response);
          // Mark as read
          await axios.post(`${API_BASE}/messages/${conv.match_id}/read`, {
            userId: this.userId
          });
        }
      }
    }
  }
}

// Main function to deploy AI agents
async function deployAIAgents() {
  const agents = [
    new AIAgent('AI Assistant', 'ai1@example.com', ['Python', 'NLP', 'Automation'], 'I am an AI assistant specializing in natural language processing and automation scripts.', 50, 'professional'),
    new AIAgent('Data Analyst', 'ai2@example.com', ['Python', 'Data Science', 'ML'], 'Experienced data analyst with machine learning expertise for insights and predictions.', 75, 'friendly'),
    new AIAgent('Web Developer', 'ai3@example.com', ['JavaScript', 'React', 'Node.js'], 'Full-stack web developer creating modern, responsive applications.', 60, 'friendly'),
    new AIAgent('DevOps Engineer', 'ai4@example.com', ['Docker', 'AWS', 'CI/CD'], 'DevOps specialist for cloud infrastructure and deployment automation.', 80, 'professional')
  ];

  for (const agent of agents) {
    try {
      // Check if user already exists
      let user = await axios.post(`${API_BASE}/auth/login`, { email: agent.email }).catch(() => null);
      if (user && user.data && user.data.user) {
        agent.userId = user.data.user.id;
        console.log(`AI Agent ${agent.name} already exists with userId: ${agent.userId}`);
        // Get profile
        const profileRes = await axios.get(`${API_BASE}/profiles/user/${agent.userId}`).catch(() => null);
        if (profileRes && profileRes.data) {
          agent.profileId = profileRes.data.id;
          console.log(`AI Agent ${agent.name} profile exists: ${agent.profileId}`);
        } else {
          await agent.createProfile();
        }
      } else {
        await agent.signup();
        await agent.createProfile();
      }
    } catch (err) {
      console.error(`Failed to deploy ${agent.name}:`, err.message);
    }
  }

  console.log('AI Agents deployed. Starting interaction loop...');

  // Continuous loop for agent interactions
  setInterval(async () => {
    for (const agent of agents) {
      try {
        // Swipe on new profiles
        const profiles = await agent.getProfilesToSwipe();
        for (const profile of profiles.slice(0, 3)) { // Limit to avoid spam
          await agent.swipe(profile.id);
        }

        // Check and respond to messages
        await agent.checkAndRespond();
      } catch (err) {
        console.error(`Error in agent loop for ${agent.name}:`, err.message);
      }
    }
  }, 30000); // Check every 30 seconds
}

// Run if called directly
if (require.main === module) {
  deployAIAgents().catch(console.error);
}

module.exports = { AIAgent, deployAIAgents };