import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, LineChart, Line, Legend,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


/* ─────────────────────────── constants ──────────────────────────────────── */

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                   'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const BRAND_COLORS = [
  '#0052A5','#1A6BBF','#2D8FD4','#3AAEE0',
  '#0E7E56','#15A870','#D48A00','#B85C00',
  '#7C5CBF','#C0392B','#2C7873','#6A0572',
];

const CustomTooltipBar = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1A1F2E', borderRadius: 10, padding: '10px 16px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: 'none',
    }}>
      <p style={{ color: '#8A94A6', fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '2px 0 0' }}>
          {p.value?.toLocaleString()}
          <span style={{ fontSize: 11, color: '#8A94A6', marginLeft: 4 }}>คัน</span>
        </p>
      ))}
    </div>
  );
};

export default function SalesReport() {
  const navigate = useNavigate();

  const [loading,    setLoading]    = useState(false);
  const [reportData, setReportData] = useState(null); 
  const [activeYear, setActiveYear] = useState(null);
  const [chartMode,  setChartMode]  = useState('monthly');
  const [chartBrand, setChartBrand] = useState('__all__');
  const [hideZero,   setHideZero]   = useState(true);
  const [activeTab,  setActiveTab]  = useState('table');

  // --- จุดปรับปรุงที่ 2: เปลี่ยน localhost เป็น IP ของ Ubuntu Server ---
  const API_URL = "http://192.168.99.173:5000";

  const fetchDataFromDB = async () => {
    setLoading(true);
    try {
      const query = selectedBranch && selectedBranch !== '__all__'
        ? `?branch=${encodeURIComponent(selectedBranch)}`
        : '';
      const res = await axios.get(`${API_URL}/api/sales${query}`); 
      const raw = res.data.map(item => ({
        brand: item.car_brand || item.brand || 'UNKNOWN',
        count: parseInt(item.sales_count || item.count) || 0,
        month: parseInt(item.report_month || item.month) || 1, 
        year:  parseInt(item.report_year || item.year) || (new Date().getFullYear() + 543),
      }));
      setReportData(buildReportData(raw));
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถดึงข้อมูลจาก Database ได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const [branches, setBranches] = useState([]); 
  const [selectedBranch, setSelectedBranch] = useState('__all__'); 

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/branches`);
      setBranches(res.data);
    } catch (err) {
      console.error("ดึงรายชื่อจังหวัดไม่สำเร็จ", err);
    }
  };

  useEffect(() => { fetchBranches(); }, []); 
  useEffect(() => { fetchDataFromDB(); }, [selectedBranch]); 

  const buildReportData = (raw) => {
    const byYear = {};
    raw.forEach(item => {
      const y = item.year;
      if (!byYear[y]) byYear[y] = {};
      const b = item.brand.trim().toUpperCase();
      if (!byYear[y][b]) byYear[y][b] = Array(12).fill(null);
      const mi = (item.month || 1) - 1;
      byYear[y][b][mi] = (byYear[y][b][mi] || 0) + item.count;
    });
    const years = Object.keys(byYear).sort((a, b) => b - a);
    const result = { years, byYear: {} };
    years.forEach(y => {
      const brandMap = byYear[y];
      const monthTotals = Array(12).fill(0);
      const brands = Object.entries(brandMap).map(([name, counts]) => {
        counts.forEach((v, i) => { if (v) monthTotals[i] += v; });
        const total = counts.reduce((s, v) => s + (v || 0), 0);
        return { name, counts, total };
      });
      const grandTotal = brands.reduce((s, b) => s + b.total, 0);
      brands.forEach(b => { b.share = grandTotal > 0 ? (b.total / grandTotal * 100) : 0; });
      brands.sort((a, b) => b.total - a.total);
      const activeMonths = monthTotals.filter(v => v > 0).length || 1;
      result.byYear[y] = { brands, monthTotals, grandTotal, activeMonths };
    });
    return result;
  };

  useEffect(() => {
    if (reportData?.years?.length && !activeYear) {
      setActiveYear(reportData.years[0]);
    }
  }, [reportData, activeYear]);

  const yd = activeYear && reportData ? reportData.byYear[activeYear] : null;

  const monthlyChartData = yd ? yd.monthTotals.map((total, i) => ({
    month: MONTHS_TH[i],
    total: total || 0
  })) : [];

  const brandChartData = yd ? (
    chartBrand === '__all__' 
      ? yd.brands.filter(b => b.total > 0).map(b => ({ brand: b.name, count: b.total }))
      : MONTHS_TH.map((m, i) => {
          const bData = yd.brands.find(b => b.name === chartBrand);
          return { month: m, count: bData ? (bData.counts[i] || 0) : 0 };
        })
  ) : [];

  const exportCSV = () => {
    if (!yd) return;
    const rows = [['ยี่ห้อ', ...MONTHS_TH, 'รวม', 'ส่วนแบ่ง%']];
    yd.brands.filter(b => b.total > 0).forEach(b => {
      rows.push([b.name, ...b.counts.map(v => v ?? 0), b.total, b.share.toFixed(2)]);
    });
    rows.push(['รวมทั้งหมด', ...yd.monthTotals, yd.grandTotal, '100.00']);
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
    a.download = `sales_report_${activeYear}.csv`;
    a.click();
  };

  // --- จุดปรับปรุงที่ 3: แก้ไข Export PDF ให้รองรับภาษาไทย ---
  const exportPDF = () => {
    if (!yd) return;
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const fontName = "Sarabun"; 
      
      // เรียกใช้ addFont จากไฟล์ .js ที่ import มา
      doc.addFont('Sarabun-normal.ttf', fontName, 'normal');
      doc.setFont(fontName);

      const title = `รายงานยอดจำหน่ายยานยนต์ ${selectedBranch === '__all__' ? 'ทุกจังหวัด' : 'จังหวัด ' + selectedBranch} ปี ${activeYear}`;

      autoTable(doc, {
        html: '#sales-table',
        startY: 20,
        styles: {
          font: fontName, 
          fontSize: 10,
          cellPadding: 3,
          halign: 'center',
          fontStyle: 'normal'
        },
        headStyles: {
          fillColor: [0, 82, 165],
          textColor: [255, 255, 255],
          font: fontName,
          fontStyle: 'normal'
        },
        footStyles: {
          fillColor: [26, 31, 46],
          textColor: [255, 255, 255],
          font: fontName
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 40 }
        },
        didDrawPage: (data) => {
          doc.setFont(fontName); 
          doc.setFontSize(16);
          doc.text(title, 14, 15);
        },
        didParseCell: (data) => {
          if (data.cell.text[0] === '—' || data.cell.text[0] === '') {
            data.cell.text[0] = '0';
          }
        },
        theme: 'grid'
      });

      doc.save(`sales-report-${selectedBranch}-${activeYear}.pdf`);
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("Export PDF ไม่สำเร็จ: " + err.message);
    }
  };
  
  /* ── styles (เหมือนเดิมทุกประการ) ── */
  const S = {
    root:   { minHeight: '100vh', background: '#F2F6FC', fontFamily: "'Sarabun','Segoe UI',sans-serif", color: '#1A1F2E' },
    topbar: { background: '#fff', borderBottom: '1px solid rgba(0,82,165,.10)', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 },
    content:{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' },
    card:   { background: '#fff', borderRadius: 18, border: '1px solid rgba(0,82,165,.10)', overflow: 'hidden', marginBottom: 16 },
    cardPad:{ padding: '22px 28px' },
    label:  { fontSize: 9.5, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8A94A6', marginBottom: 10, display: 'block' },
    input:  { width: '100%', padding: '11px 14px', background: '#F2F6FC', border: '2px solid transparent', borderRadius: 12, fontSize: 13, fontWeight: 500, color: '#1A1F2E', outline: 'none', fontFamily: 'inherit' },
    btnPrimary: (dis) => ({
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '10px 20px', background: dis ? '#8A94A6' : '#0052A5',
      color: '#fff', border: 'none', borderRadius: 12, fontSize: 13,
      fontWeight: 600, cursor: dis ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', transition: 'background .15s',
      boxShadow: dis ? 'none' : '0 4px 14px rgba(0,82,165,.25)',
    }),
    btnGhost: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#F2F6FC', color: '#0052A5', border: '1px solid rgba(0,82,165,.15)', borderRadius: 11, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
    btnDanger: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#fff5f5', color: '#c0392b', border: '1px solid #ffcdd2', borderRadius: 11, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  };

  const filteredBrands = yd
    ? (hideZero ? yd.brands.filter(b => b.total > 0) : yd.brands)
    : [];

  return (
    <div style={S.root}>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

      <div style={S.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => navigate('/')} style={{ ...S.btnGhost, gap: 6 }}>
            <i className="fa-solid fa-arrow-left" style={{ fontSize: 11 }}></i>
            กลับหน้าอัปโหลด
          </button>
          <div style={{ width: 1, height: 28, background: 'rgba(0,82,165,.12)' }}></div>
          <div>
            <p style={{ fontSize: 10, color: '#8A94A6', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600, margin: 0 }}>
              T.T.COM — Analytics
            </p>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1F2E', margin: '1px 0 0' }}>
              สรุปยอดจำหน่ายยานยนต์
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>จังหวัด/สาขา:</span>
            <select 
                value={selectedBranch} 
                onChange={(e) => setSelectedBranch(e.target.value)}
                style={{ ...S.input, width: 'auto', padding: '6px 12px' }}
            >
                <option value="__all__">ทั้งหมด</option>
                {branches.map(b => (
                <option key={b} value={b}>{b}</option>
                ))}
            </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {yd && (
            <>
              <button onClick={() => window.print()} style={S.btnGhost}>
                <i className="fa-solid fa-print" style={{ fontSize: 11 }}></i> พิมพ์
              </button>
              <button onClick={exportPDF} style={S.btnDanger}>
                <i className="fa-solid fa-file-pdf" style={{ fontSize: 11 }}></i> Export PDF
              </button>
              <button onClick={exportCSV} style={S.btnPrimary(false)}>
                <i className="fa-solid fa-file-arrow-down" style={{ fontSize: 11 }}></i> Export CSV
              </button>
            </>
          )}
        </div>
      </div>

      <div style={S.content}>
        {yd && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {reportData.years.map(y => (
                  <button key={y} onClick={() => setActiveYear(y)}
                          style={{
                            padding: '7px 18px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                            border: '1px solid rgba(0,82,165,.12)', cursor: 'pointer',
                            background: activeYear === y ? '#0052A5' : '#fff',
                            color:       activeYear === y ? '#fff' : '#5A6478',
                            transition: 'all .15s',
                          }}>
                    ปี {y}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#8A94A6', fontWeight: 500 }}>
                <i className="fa-regular fa-clock" style={{ marginRight: 5 }}></i>
                {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'ยอดรวมสุทธิ',     value: yd.grandTotal.toLocaleString(), sub: 'คัน',    bg: '#E8F1FB', icon: 'fa-car',           c: '#0052A5' },
                { label: 'ยี่ห้อที่มียอด', value: yd.brands.filter(b=>b.total>0).length, sub: `จาก ${yd.brands.length} ยี่ห้อ`, bg: '#EAF6F1', icon: 'fa-award',           c: '#0E7E56' },
                { label: 'ยี่ห้ออันดับ 1',  value: yd.brands[0]?.name || '—',    sub: `${yd.brands[0]?.total.toLocaleString()} คัน`, bg: '#FFF8EC', icon: 'fa-trophy',        c: '#D48A00' },
                { label: 'เดือนที่มีข้อมูล',value: yd.activeMonths,                sub: 'เดือน',  bg: '#F3F0FF', icon: 'fa-calendar-check', c: '#7C5CBF' },
              ].map((k, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,82,165,.10)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 13 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fa-solid ${k.icon}`} style={{ color: k.c, fontSize: 17 }}></i>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#8A94A6', textTransform: 'uppercase', letterSpacing: '.07em', margin: 0 }}>{k.label}</p>
                    <p style={{ fontSize: 21, fontWeight: 700, color: '#1A1F2E', lineHeight: 1.1, margin: '2px 0 1px' }}>{k.value}</p>
                    <p style={{ fontSize: 11, color: '#8A94A6', margin: 0 }}>{k.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#fff', border: '1px solid rgba(0,82,165,.10)', borderRadius: 14, padding: 5, width: 'fit-content' }}>
              {[
                { key: 'table', icon: 'fa-table',     label: 'ตารางรายเดือน' },
                { key: 'chart', icon: 'fa-chart-bar', label: 'กราฟ' },
                { key: 'share', icon: 'fa-chart-pie', label: 'ส่วนแบ่งตลาด' },
              ].map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                        style={{
                          padding: '8px 18px', borderRadius: 10, border: 'none', fontSize: 12,
                          fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                          background: activeTab === t.key ? '#0052A5' : 'transparent',
                          color:       activeTab === t.key ? '#fff' : '#8A94A6',
                          transition: 'all .15s', fontFamily: 'inherit',
                        }}>
                  <i className={`fa-solid ${t.icon}`} style={{ fontSize: 11 }}></i>
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'table' && (
              <div style={S.card}>
                <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(0,82,165,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  
                  <span style={S.label}>
                    <i className="fa-solid fa-table" style={{ color: '#0052A5', marginRight: 6 }}></i>
                    ตารางสรุปยอดจำหน่ายยานยนต์ รายยี่ห้อ รายเดือน — ปี {activeYear}
                  </span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5A6478', cursor: 'pointer' }}>
                    <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} />
                    แสดงเฉพาะยี่ห้อที่มียอด
                  </label>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table id="sales-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr>
                        <th style={thDark({ textAlign: 'center', minWidth: 90 })} colSpan={MONTHS_TH.length + 4}>
                            สรุปยอดจำหน่ายยานยนต์ {selectedBranch === '__all__' ? 'ทุกจังหวัด' : `จังหวัด ${selectedBranch}`} — ปี พ.ศ. {activeYear}
                        </th>
                      </tr>
                      <tr>
                        <th style={thBlue({ textAlign: 'left', paddingLeft: 18, minWidth: 90, position: 'sticky', left: 0, zIndex: 2 })}>ยี่ห้อ</th>
                        {MONTHS_TH.map(m => <th key={m} style={thBlue({ minWidth: 56 })}>{m}</th>)}
                        <th style={thDeep({ minWidth: 60 })}>รวม</th>
                        <th style={thDeep({ minWidth: 70 })}>เฉลี่ย/เดือน</th>
                        <th style={thDeep({ minWidth: 72 })}>%ตลาด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBrands.map((brand, bi) => {
                        const color = BRAND_COLORS[bi % BRAND_COLORS.length];
                        const avg   = brand.total > 0 ? (brand.total / yd.activeMonths).toFixed(2) : '—';
                        return (
                          <React.Fragment key={brand.name}>
                            <tr style={{ cursor: 'default' }}
                                onMouseEnter={e => [...e.currentTarget.parentElement.querySelectorAll(`[data-brand="${brand.name}"]`)].forEach(r => r.style.background = '#E8F1FB')}
                                onMouseLeave={e => [...e.currentTarget.parentElement.querySelectorAll(`[data-brand="${brand.name}"]`)].forEach(r => r.style.background = '')}>
                              <td data-brand={brand.name} style={{ padding: '9px 10px 9px 18px', fontWeight: 700, color: '#1A1F2E', borderBottom: '1px solid rgba(0,82,165,.06)', position: 'sticky', left: 0, background: '#fff', zIndex: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }}></span>
                                {brand.name}
                              </td>
                              {brand.counts.map((v, mi) => (
                                <td key={mi} data-brand={brand.name} style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: v ? '#0052A5' : '#d1d5db', fontSize: v ? 14 : 12, borderBottom: '1px solid rgba(0,82,165,.06)' }}>
                                  {v ?? '—'}
                                </td>
                              ))}
                              <td data-brand={brand.name} style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: '#C0392B', fontSize: 14, borderBottom: '1px solid rgba(0,82,165,.06)' }}>
                                {brand.total || '—'}
                              </td>
                              <td data-brand={brand.name} style={{ padding: '9px 10px', textAlign: 'center', fontSize: 12, color: '#5A6478', borderBottom: '1px solid rgba(0,82,165,.06)' }}>
                                {avg}
                              </td>
                              <td data-brand={brand.name} style={{ padding: '9px 10px', textAlign: 'center', borderBottom: '1px solid rgba(0,82,165,.06)' }}>
                                {brand.share > 0 && (
                                  <>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#D48A00' }}>{brand.share.toFixed(2)}%</span>
                                    <div style={{ height: 3, background: 'rgba(0,82,165,.1)', borderRadius: 2, marginTop: 4 }}>
                                      <div style={{ height: '100%', width: `${Math.min(brand.share, 100)}%`, background: color, borderRadius: 2 }}></div>
                                    </div>
                                  </>
                                )}
                              </td>
                            </tr>
                            <tr>
                                <td data-brand={brand.name} style={{ padding: '1px 10px 7px 18px', fontSize: 9, color: '#8A94A6', borderBottom: '1px solid rgba(0,82,165,.06)', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>%</td>
                                {brand.counts.map((v, mi) => {
                                    const pct = yd.monthTotals[mi] > 0 && v ? ((v / yd.monthTotals[mi]) * 100).toFixed(2) + '%' : '';
                                    return <td key={mi} data-brand={brand.name} style={{ padding: '1px 10px 7px', textAlign: 'center', fontSize: 10.5, color: '#8A94A6', borderBottom: '1px solid rgba(0,82,165,.06)' }}>{pct}</td>;
                                })}
                                <td data-brand={brand.name} style={{ padding: '1px 10px 7px', textAlign: 'center', fontSize: 10.5, color: '#C0392B', fontWeight: 600, borderBottom: '1px solid rgba(0,82,165,.06)', background: 'rgba(192, 57, 43, 0.03)' }}>
                                    {yd.grandTotal > 0 && brand.total > 0 ? ((brand.total / yd.grandTotal) * 100).toFixed(2) + '%' : ''}
                                </td>
                                <td colSpan={2} style={{ borderBottom: '1px solid rgba(0,82,165,.06)' }}></td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ background: '#1A1F2E', color: '#fff', padding: '13px 10px 13px 18px', fontWeight: 700, fontSize: 13, position: 'sticky', left: 0, zIndex: 1 }}>รวมทั้งหมด</td>
                        {yd.monthTotals.map((v, i) => (
                          <td key={i} style={{ background: '#1A1F2E', color: v ? '#F97316' : 'rgba(255,255,255,.3)', padding: '13px 10px', textAlign: 'center', fontWeight: 700, fontSize: v ? 14 : 11 }}>
                            {v || '—'}
                          </td>
                        ))}
                        <td style={{ background: '#1A1F2E', color: '#F97316', padding: '13px 10px', textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{yd.grandTotal.toLocaleString()}</td>
                        <td style={{ background: '#1A1F2E', color: 'rgba(255,255,255,.6)', padding: '13px 10px', textAlign: 'center', fontSize: 12 }}>{(yd.grandTotal / yd.activeMonths).toFixed(2)}</td>
                        <td style={{ background: '#1A1F2E', color: '#4ADE80', padding: '13px 10px', textAlign: 'center', fontWeight: 600, fontSize: 12 }}>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'chart' && (
              <div style={S.card}>
                <div style={{ ...S.cardPad, borderBottom: '1px solid rgba(0,82,165,.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <span style={S.label}>
                      <i className="fa-solid fa-chart-bar" style={{ color: '#0052A5', marginRight: 6 }}></i>
                      กราฟยอดจำหน่าย — ปี {activeYear}
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 4, background: '#F2F6FC', borderRadius: 10, padding: 4 }}>
                        {[{k:'monthly',l:'รายเดือน'},{k:'brand',l:'รายยี่ห้อ'}].map(m => (
                          <button key={m.k} onClick={() => setChartMode(m.k)}
                                  style={{ padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: chartMode === m.k ? '#0052A5' : 'transparent', color: chartMode === m.k ? '#fff' : '#8A94A6', transition: 'all .15s' }}>
                            {m.l}
                          </button>
                        ))}
                      </div>
                      {chartMode === 'brand' && (
                        <select value={chartBrand} onChange={e => setChartBrand(e.target.value)}
                                style={{ ...S.input, width: 'auto', padding: '7px 12px', borderRadius: 10, fontSize: 12, background: '#F2F6FC', border: '1px solid rgba(0,82,165,.12)', cursor: 'pointer' }}>
                          <option value="__all__">ทุกยี่ห้อ (รวม)</option>
                          {yd.brands.filter(b => b.total > 0).map(b => (
                            <option key={b.name} value={b.name}>{b.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ padding: '24px 28px 16px' }}>
                  <ResponsiveContainer width="100%" height={320}>
                    {chartMode === 'monthly' ? (
                      <BarChart data={monthlyChartData} margin={{ top: 16, right: 8, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,82,165,.07)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8A94A6', fontFamily: 'Sarabun' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#8A94A6', fontFamily: 'Sarabun' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltipBar />} cursor={{ fill: 'rgba(0,82,165,.04)' }} />
                        <Bar dataKey="total" radius={[6,6,0,0]} maxBarSize={52} fill="#0052A5">
                          {monthlyChartData.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    ) : (
                      <BarChart
                        data={brandChartData}
                        margin={{ top: 16, right: 8, left: 0, bottom: chartBrand === '__all__' ? 40 : 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,82,165,.07)" />
                        <XAxis
                          dataKey={chartBrand === '__all__' ? 'brand' : 'month'}
                          interval={0}
                          angle={chartBrand === '__all__' ? -35 : 0}
                          textAnchor={chartBrand === '__all__' ? 'end' : 'middle'}
                          tick={{ fontSize: 11, fill: '#8A94A6', fontFamily: 'Sarabun' }}
                          axisLine={false} tickLine={false}
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#8A94A6', fontFamily: 'Sarabun' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltipBar />} cursor={{ fill: 'rgba(0,82,165,.04)' }} />
                        <Bar dataKey="count" radius={[6,6,0,0]} maxBarSize={52}>
                          {brandChartData.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'share' && (
              <div style={S.card}>
                <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(0,82,165,.08)' }}>
                  <span style={S.label}>
                    <i className="fa-solid fa-chart-pie" style={{ color: '#0052A5', marginRight: 6 }}></i>
                    ส่วนแบ่งตลาด (Market Share) — ปี {activeYear}
                  </span>
                </div>
                <div style={{ padding: '8px 0 16px' }}>
                  {yd.brands.filter(b => b.total > 0).map((b, i) => {
                    const color = BRAND_COLORS[i % BRAND_COLORS.length];
                    return (
                      <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 24px', borderBottom: '1px solid rgba(0,82,165,.05)', transition: 'background .1s' }}
                           onMouseEnter={e => e.currentTarget.style.background = '#F2F6FC'}
                           onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#8A94A6', width: 20, textAlign: 'right' }}>{i + 1}</span>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }}></span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1F2E', width: 90, flexShrink: 0 }}>{b.name}</span>
                        <div style={{ flex: 1, height: 8, background: '#F2F6FC', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${b.share.toFixed(1)}%`, background: color, borderRadius: 4, transition: 'width .5s' }}></div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1F2E', width: 70, textAlign: 'right' }}>{b.total.toLocaleString()} คัน</span>
                        <span style={{ fontSize: 12, fontWeight: 700, width: 56, textAlign: 'right', color }}>{b.share.toFixed(2)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const thDark = (extra = {}) => ({
  background: '#1A1F2E', color: '#fff', fontSize: 12, fontWeight: 600,
  letterSpacing: '.05em', padding: '13px 14px', textAlign: 'center', ...extra,
});
const thBlue = (extra = {}) => ({
  background: '#0052A5', color: 'rgba(255,255,255,.85)', fontSize: 10,
  fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase',
  padding: '10px 10px', textAlign: 'center', whiteSpace: 'nowrap',
  borderRight: '1px solid rgba(255,255,255,.1)', ...extra,
});
const thDeep = (extra = {}) => ({
  background: '#003C7A', color: 'rgba(255,255,255,.8)', fontSize: 10,
  fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase',
  padding: '10px 10px', textAlign: 'center', whiteSpace: 'nowrap', ...extra,
});