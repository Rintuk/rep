import axios from "axios";

async function testNews() {
  try {
    const api = axios.create({ baseURL: "https://rep-production-cf90.up.railway.app" });
    
    // Register
    const email = `testuser_${Date.now()}@test.com`;
    await api.post("/auth/register", { email, password: "testPassword123" });
    
    // Login
    const loginRes = await api.post("/auth/login", { email, password: "testPassword123" });
    const token = loginRes.data.access_token;
    
    // Fetch news
    const newsRes = await api.get("/api/news", { headers: { Authorization: `Bearer ${token}` } });
    console.log("News count:", newsRes.data.length);
    newsRes.data.forEach(n => {
      console.log(`News ${n.id}: title=${n.title}, image_url=${n.image_url ? n.image_url.substring(0, 30) + '...' : n.image_url}`);
    });
  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}

testNews();
