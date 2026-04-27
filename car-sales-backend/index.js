const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 1. ตรวจสอบ API Key: คัดลอกมาวางใหม่ให้ชัวร์ว่าไม่มีเว้นวรรคปน
const genAI = new GoogleGenerativeAI("AIzaSyDL0JXAm0NNr2jx9Hjoks41OWlp59zyB3Y");

// แก้ปัญหา 404: ลองใช้ชื่อรุ่นแบบไม่มี models/ นำหน้า (ตามที่ Error ฟ้องว่าหา models/gemini-1.5-flash ไม่เจอ)
const model = genAI.getGenerativeModel({ 
    model: "gemini-3.1-flash-lite-preview", 
    generationConfig: { responseMimeType: "application/json" } 
});

const dbConfig = { 
    host: 'localhost', 
    user: 'root', 
    password: '063910', 
    database: 'car_sales_report' 
};

const pool = mysql.createPool(dbConfig);

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) throw new Error("ไม่พบไฟล์ที่อัปโหลด");

        const pdfBase64 = req.file.buffer.toString("base64");
        const prompt = `Extract car registration data from this PDF as a JSON array. 
            Include: branch (province), type (car type), brand (correct TOMOTA to TOYOTA), and count. 
            Return ONLY the JSON array.`;

        const result = await model.generateContent([
            { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
            prompt
        ]);

        let responseText = result.response.text();
        responseText = responseText.replace(/```json|```/gi, "").trim();
        const salesData = JSON.parse(responseText);

        // ใช้ pool แทนการสร้าง connection ใหม่ทุกรอบ
        const query = "INSERT INTO sales (branch_name, car_brand, car_type, sales_count, report_month, report_year) VALUES ?";
        const values = salesData.map(s => [s.branch, s.brand, s.type, s.count, 3, 2569]);

        if (values.length > 0) {
            await pool.query(query, [values]);
        }

        res.json({ success: true, results: salesData });

    } catch (err) {
        console.error("AI Error:", err.message);
        res.status(500).json({ error: "AI Error: " + err.message });
    }
});

// --- จุดที่ 2: แก้ไข /api/branches (เปลี่ยนจาก db เป็น pool) ---
app.get('/api/branches', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT DISTINCT branch_name FROM sales ORDER BY branch_name ASC');
    res.json(rows.map(r => r.branch_name)); 
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- จุดที่ 3: แก้ไข /api/sales ให้รองรับการกรองข้อมูลจริง ---
app.get('/api/sales', async (req, res) => {
  const { branch } = req.query;
  try {
    let sql = 'SELECT * FROM sales';
    const params = [];
    
    if (branch && branch !== '__all__') {
      sql += ' WHERE branch_name = ?';
      params.push(branch);
    }
    
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => console.log('Server is running on port 5000'));