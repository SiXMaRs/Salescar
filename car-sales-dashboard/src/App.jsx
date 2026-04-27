import React, { useState } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, LabelList
} from 'recharts';

const BRAND_COLORS = [
  '#0052A5', '#1A6BBF', '#2D8FD4', '#3AAEE0',
  '#0E7E56', '#15A870', '#D48A00', '#B85C00',
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#1A1F2E',
        border: 'none',
        borderRadius: '10px',
        padding: '10px 16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}>
        <p style={{ color: '#8A94A6', fontSize: '11px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {payload[0].payload.brand}
        </p>
        <p style={{ color: '#fff', fontSize: '20px', fontWeight: 700, margin: '2px 0 0' }}>
          {payload[0].value.toLocaleString()}
          <span style={{ fontSize: '12px', color: '#8A94A6', marginLeft: '4px' }}>คัน</span>
        </p>
      </div>
    );
  }
  return null;
};

function App() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setFileName(f.name);
  };

  const onUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('pdf', file);
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/upload', formData);
      const results = res.data.results.map(item => ({
        ...item,
        count: parseInt(item.count) || 0
      }));
      setRawData(results);
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getDynamicTableData = () => {
    const summaryMap = new Map();
    rawData.forEach(item => {
      const brand = item.brand.trim().toUpperCase();
      summaryMap.set(brand, (summaryMap.get(brand) || 0) + item.count);
    });
    const list = Array.from(summaryMap, ([brand, total]) => ({ brand, total }));
    const grandTotal = list.reduce((sum, item) => sum + item.total, 0);
    const listWithPercent = list.map(item => ({
      ...item,
      percent: grandTotal > 0 ? ((item.total / grandTotal) * 100).toFixed(2) : '0.00',
      share: grandTotal > 0 ? (item.total / grandTotal) : 0,
    })).sort((a, b) => b.total - a.total);
    return { listWithPercent, grandTotal };
  };

  const { listWithPercent: tableData, grandTotal } = getDynamicTableData();

  const styles = {
    root: {
      minHeight: '100vh',
      background: '#F2F6FC',
      fontFamily: "'Sarabun', 'Segoe UI', sans-serif",
      color: '#1A1F2E',
      padding: '32px 24px',
    },
    wrap: {
      maxWidth: '960px',
      margin: '0 auto',
    },
    // Header
    header: {
      marginBottom: '28px',
    },
    eyebrow: {
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.15em',
      textTransform: 'uppercase',
      color: '#0052A5',
      marginBottom: '6px',
    },
    title: {
      fontSize: '26px',
      fontWeight: 700,
      color: '#1A1F2E',
      margin: 0,
      lineHeight: 1.2,
    },
    subtitle: {
      fontSize: '13px',
      color: '#8A94A6',
      marginTop: '4px',
      fontWeight: 400,
    },
    // Card
    card: {
      background: '#fff',
      borderRadius: '20px',
      border: '1px solid rgba(0,82,165,0.1)',
      overflow: 'hidden',
    },
    cardPad: {
      padding: '28px 32px',
    },
    sectionLabel: {
      fontSize: '9.5px',
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#8A94A6',
      marginBottom: '14px',
    },
    // Upload zone
    dropzone: (over) => ({
      border: `2px dashed ${over ? '#0052A5' : 'rgba(0,82,165,0.2)'}`,
      borderRadius: '16px',
      background: over ? '#E8F1FB' : '#F2F6FC',
      padding: '36px 24px',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.15s',
    }),
    dropIcon: {
      width: '44px',
      height: '44px',
      background: '#E8F1FB',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 12px',
    },
    dropTitle: {
      fontSize: '14px',
      fontWeight: 600,
      color: '#1A1F2E',
      marginBottom: '4px',
    },
    dropSub: {
      fontSize: '12px',
      color: '#8A94A6',
    },
    fileChip: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '14px',
      padding: '6px 14px',
      background: '#E8F1FB',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 500,
      color: '#0052A5',
    },
    // Button
    btn: (disabled) => ({
      width: '100%',
      marginTop: '14px',
      padding: '14px',
      background: disabled ? '#8A94A6' : '#0052A5',
      color: '#fff',
      border: 'none',
      borderRadius: '14px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      transition: 'background 0.15s',
      boxShadow: disabled ? 'none' : '0 4px 16px rgba(0,82,165,0.25)',
    }),
    // Divider
    divider: {
      borderTop: '1px solid rgba(0,82,165,0.08)',
      margin: '0',
    },
    // Stats row
    statsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '0',
      borderBottom: '1px solid rgba(0,82,165,0.08)',
    },
    statCell: (last) => ({
      padding: '20px 24px',
      borderRight: last ? 'none' : '1px solid rgba(0,82,165,0.08)',
    }),
    statLabel: {
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: '#8A94A6',
      marginBottom: '4px',
    },
    statVal: {
      fontSize: '22px',
      fontWeight: 700,
      color: '#1A1F2E',
      lineHeight: 1,
    },
    statSub: {
      fontSize: '11px',
      color: '#8A94A6',
      marginTop: '2px',
    },
    // Chart
    chartWrap: {
      padding: '24px 32px 8px',
    },
    // Table
    tableWrap: {
      padding: '0 32px 28px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
    },
    thead: {
      background: '#F2F6FC',
    },
    th: {
      padding: '11px 16px',
      fontSize: '9.5px',
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: '#8A94A6',
      textAlign: 'left',
    },
    td: {
      padding: '13px 16px',
      fontSize: '13px',
      borderTop: '1px solid rgba(0,82,165,0.06)',
    },
    barBg: {
      height: '4px',
      background: '#F2F6FC',
      borderRadius: '2px',
      marginTop: '5px',
      overflow: 'hidden',
    },
    // Total row
    totalRow: {
      background: '#1A1F2E',
    },
    totalTd: {
      padding: '14px 16px',
      fontSize: '13px',
      fontWeight: 600,
      color: '#fff',
    },
    percentBadge: (color) => ({
      display: 'inline-block',
      padding: '2px 9px',
      borderRadius: '20px',
      background: color + '18',
      color: color,
      fontSize: '12px',
      fontWeight: 600,
    }),
  };

  return (
    <div style={styles.root}>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

      <div style={styles.wrap}>

        {/* Header */}
        <div style={styles.header}>
          <p style={styles.eyebrow}>T.T.COM — Analytics</p>
          <h1 style={styles.title}>รายงานวิเคราะห์ยอดขาย</h1>
          <p style={styles.subtitle}>อัปโหลดไฟล์ PDF เพื่อให้ AI วิเคราะห์และสรุปข้อมูลรายยี่ห้อโดยอัตโนมัติ</p>
        </div>

        {/* Upload card */}
        <div style={{ ...styles.card, marginBottom: '16px' }}>
          <div style={styles.cardPad}>
            <p style={styles.sectionLabel}>
              <i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: '6px', color: '#0052A5' }}></i>
              อัปโหลดไฟล์
            </p>

            {/* Dropzone */}
            <div
              style={styles.dropzone(dragOver)}
              onClick={() => document.getElementById('pdf-input').click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            >
              <input
                id="pdf-input"
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
              <div style={styles.dropIcon}>
                <i className="fa-solid fa-file-pdf" style={{ color: '#0052A5', fontSize: '20px' }}></i>
              </div>
              <p style={styles.dropTitle}>
                {fileName ? 'เปลี่ยนไฟล์' : 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือก'}
              </p>
              <p style={styles.dropSub}>รองรับไฟล์ .pdf เท่านั้น</p>
              {fileName && (
                <div style={styles.fileChip}>
                  <i className="fa-solid fa-file-lines" style={{ fontSize: '11px' }}></i>
                  {fileName}
                </div>
              )}
            </div>

            <button
              onClick={onUpload}
              disabled={loading || !file}
              style={styles.btn(loading || !file)}
            >
              {loading
                ? <><i className="fa-solid fa-spinner fa-spin"></i> AI กำลังประมวลผล...</>
                : <><i className="fa-solid fa-magnifying-glass-chart"></i> วิเคราะห์ข้อมูล PDF</>
              }
            </button>
          </div>
        </div>

        {/* Results */}
        {rawData.length > 0 && (
          <div style={styles.card}>

            {/* Stats row */}
            <div style={styles.statsRow}>
              <div style={styles.statCell(false)}>
                <p style={styles.statLabel}>ยี่ห้อที่พบ</p>
                <p style={styles.statVal}>{tableData.length}</p>
                <p style={styles.statSub}>ยี่ห้อ</p>
              </div>
              <div style={styles.statCell(false)}>
                <p style={styles.statLabel}>ยอดรวมสุทธิ</p>
                <p style={styles.statVal}>{grandTotal.toLocaleString()}</p>
                <p style={styles.statSub}>คัน</p>
              </div>
              <div style={styles.statCell(true)}>
                <p style={styles.statLabel}>ยี่ห้ออันดับ 1</p>
                <p style={{ ...styles.statVal, fontSize: '16px', color: '#0052A5' }}>
                  {tableData[0]?.brand || '—'}
                </p>
                <p style={styles.statSub}>{tableData[0]?.total.toLocaleString()} คัน</p>
              </div>
            </div>

            {/* Chart */}
            <div style={styles.chartWrap}>
              <p style={styles.sectionLabel}>
                <i className="fa-solid fa-chart-bar" style={{ marginRight: '6px', color: '#0052A5' }}></i>
                ยอดขายรายยี่ห้อ
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={rawData} margin={{ top: 16, right: 8, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,82,165,0.07)" />
                  <XAxis
                    dataKey="brand"
                    interval={0}
                    angle={-40}
                    textAnchor="end"
                    tick={{ fontSize: 11, fill: '#8A94A6', fontFamily: 'Sarabun' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#8A94A6', fontFamily: 'Sarabun' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,82,165,0.04)' }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {rawData.map((e, i) => (
                      <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="top"
                      style={{ fontSize: '11px', fontWeight: 600, fill: '#5A6478', fontFamily: 'Sarabun' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={styles.divider}></div>

            {/* Table */}
            <div style={styles.tableWrap}>
              <p style={{ ...styles.sectionLabel, paddingTop: '24px' }}>
                <i className="fa-solid fa-table-list" style={{ marginRight: '6px', color: '#0052A5' }}></i>
                สรุปยอดขายรายยี่ห้อ
              </p>
              <table style={styles.table}>
                <thead style={styles.thead}>
                  <tr>
                    <th style={{ ...styles.th, borderRadius: '10px 0 0 10px', width: '40px' }}>#</th>
                    <th style={styles.th}>ยี่ห้อรถ</th>
                    <th style={styles.th}>ยอดรวม</th>
                    <th style={styles.th}>ส่วนแบ่งตลาด</th>
                    <th style={{ ...styles.th, borderRadius: '0 10px 10px 0' }}>สัดส่วน (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((item, idx) => {
                    const color = BRAND_COLORS[idx % BRAND_COLORS.length];
                    return (
                      <tr key={idx} style={{ transition: 'background 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F2F6FC'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ ...styles.td, color: '#8A94A6', fontSize: '12px', fontWeight: 500 }}>
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td style={{ ...styles.td, fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              width: '8px', height: '8px', borderRadius: '2px',
                              background: color, flexShrink: 0,
                            }}></span>
                            {item.brand}
                          </div>
                        </td>
                        <td style={{ ...styles.td, fontWeight: 700 }}>
                          {item.total.toLocaleString()}
                          <span style={{ color: '#8A94A6', fontWeight: 400, marginLeft: '4px', fontSize: '11px' }}>คัน</span>
                        </td>
                        <td style={styles.td}>
                          <div style={{ minWidth: '100px' }}>
                            <div style={styles.barBg}>
                              <div style={{
                                height: '100%',
                                width: `${item.share * 100}%`,
                                background: color,
                                borderRadius: '2px',
                                transition: 'width 0.6s ease',
                              }}></div>
                            </div>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.percentBadge(color)}>{item.percent}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={styles.totalRow}>
                    <td style={{ ...styles.totalTd, borderRadius: '0 0 0 14px', color: '#8A94A6', fontSize: '11px' }}>—</td>
                    <td style={styles.totalTd}>ยอดรวมสุทธิทั้งไฟล์</td>
                    <td style={styles.totalTd}>
                      {grandTotal.toLocaleString()}
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400, marginLeft: '4px', fontSize: '11px' }}>คัน</span>
                    </td>
                    <td style={styles.totalTd}></td>
                    <td style={{ ...styles.totalTd, borderRadius: '0 0 14px 0' }}>
                      <span style={{ ...styles.percentBadge('#4ADE80'), background: 'rgba(74,222,128,0.15)' }}>100.00%</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default App;