const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- Configuration ---
const GENAI_API_KEY = "AIzaSyBvX8bEiHDKIa3md0rgpFlAFAuTJy9U4Mg"; 
const dbConfig = { 
    host: 'localhost', 
    user: 'root', 
    password: 'P@ssw0rd#1', 
    database: 'car_sales_report' 
};

const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-3.1-flash-lite-preview", 
    generationConfig: { responseMimeType: "application/json" } 
});

const pool = mysql.createPool(dbConfig);
const upload = multer({ storage: multer.memoryStorage() });

// --- API Endpoints ---

app.post('/api/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) throw new Error("ไม่พบไฟล์ที่อัปโหลด");

        const fileBase64 = req.file.buffer.toString("base64");
        const fileMimeType = req.file.mimetype;

        const supportedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
        if (!supportedTypes.includes(fileMimeType)) {
            return res.status(400).json({ error: "รองรับเฉพาะไฟล์ PDF และรูปภาพเท่านั้น" });
        }

        // ปรับ Prompt ให้ล็อคชื่อจังหวัดตามที่พี่สั่ง
        const prompt = `Extract car registration data from this ${fileMimeType.includes('pdf') ? 'PDF' : 'image'} as a JSON object. 
            Include:
            - month (string, the report month and year found in document)
            - branch (string, Choose ONLY one from: 'จังหวัดศรีสะเกษ', 'อุบลราชธานี', 'อำนาจเจริญ' based on the document context)
            - results (array of objects):
                - type (string, e.g., 'รย.1', 'รย.3')
                - brand (string, correct TOMOTA to TOYOTA, HODNA to HONDA)
                - count (number only)
            Return ONLY a clean JSON object.`;

        const result = await model.generateContent([
            { inlineData: { data: fileBase64, mimeType: fileMimeType } },
            prompt
        ]);

        let responseText = result.response.text();
        responseText = responseText.replace(/```json|```/gi, "").trim();
        
        const aiOutput = JSON.parse(responseText);
        const salesData = aiOutput.results || [];
        const extractedMonth = aiOutput.month || "ไม่ระบุเดือน";
        const extractedBranch = aiOutput.branch || "ไม่ระบุสาขา";

        // บันทึกลง Database
        const query = "INSERT INTO sales (branch_name, car_brand, car_type, sales_count, report_month, report_year) VALUES ?";
        const values = salesData.map(s => [
            extractedBranch, 
            s.brand || "Unknown", 
            s.type || "Unknown", 
            parseInt(s.count) || 0, 
            3, 
            2569
        ]);

        if (values.length > 0) {
            await pool.query(query, [values]);
        }

        res.json({ 
            success: true, 
            month: extractedMonth, 
            branch: extractedBranch, 
            results: salesData 
        });

    } catch (err) {
        console.error("AI/DB Error:", err.message);
        res.status(500).json({ error: "Server Error: " + err.message });
    }
});

app.get('/api/branches', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT DISTINCT branch_name FROM sales ORDER BY branch_name ASC');
        res.json(rows.map(r => r.branch_name)); 
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://192.168.99.173:${PORT}`);
});