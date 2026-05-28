import React, { useState, useEffect } from 'react';
import { 
  FaChartLine, 
  FaCoins, 
  FaExclamationTriangle, 
  FaInbox, 
  FaCalendarAlt, 
  FaTrophy, 
  FaUserCheck, 
  FaRegMoneyBillAlt 
} from 'react-icons/fa';
import { formatPrice } from '../utils/helpers';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function Dashboard({ user, addNotification }) {
  // Stats
  const [todaySales, setTodaySales] = useState(0);
  const [weeklySales, setWeeklySales] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [cashFlow, setCashFlow] = useState({ Cash: 0, Card: 0, JazzCash: 0, EasyPaisa: 0 });

  // Lists for graphs
  const [salesTrend, setSalesTrend] = useState({ labels: [], data: [] });
  const [bestSellers, setBestSellers] = useState({ labels: [], data: [] });
  const [peakHours, setPeakHours] = useState({ labels: [], data: [] });
  const [recentBills, setRecentBills] = useState([]);

  // Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isFilterActive, setIsFilterActive] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
  }, [filterStartDate, filterEndDate, isFilterActive]);

  const fetchDashboardStats = async () => {
    try {
      let dateConstraint = 'b.status = "active"';
      let dateParams = [];

      if (isFilterActive && filterStartDate && filterEndDate) {
        dateConstraint += ' AND date(b.created_at) BETWEEN date(?) AND date(?)';
        dateParams.push(filterStartDate, filterEndDate);
      }

      // 1. Today's Sales
      const todayRows = await window.electronAPI.query(
        `SELECT SUM(net_amount) as total FROM bills b WHERE date(b.created_at) = date('now', 'localtime') AND b.status='active'`
      );
      setTodaySales(todayRows[0]?.total || 0);

      // 2. Weekly & Monthly Sales
      const weeklyRows = await window.electronAPI.query(
        `SELECT SUM(net_amount) as total FROM bills b WHERE date(b.created_at) >= date('now', '-7 days', 'localtime') AND b.status='active'`
      );
      setWeeklySales(weeklyRows[0]?.total || 0);

      const monthlyRows = await window.electronAPI.query(
        `SELECT SUM(net_amount) as total FROM bills b WHERE date(b.created_at) >= date('now', '-30 days', 'localtime') AND b.status='active'`
      );
      setMonthlySales(monthlyRows[0]?.total || 0);

      // 3. Profit / Loss
      const profitRows = await window.electronAPI.query(
        `SELECT SUM(bi.quantity * (bi.rate - p.purchase_price)) as profit 
         FROM bill_items bi 
         JOIN products p ON bi.product_id = p.id 
         JOIN bills b ON bi.bill_id = b.id 
         WHERE ${dateConstraint}`,
        dateParams
      );
      setTotalProfit(profitRows[0]?.profit || 0);

      // 4. Stock Warnings
      const lowStockRes = await window.electronAPI.query(
        'SELECT COUNT(*) as count FROM products WHERE quantity <= min_stock AND quantity > 0 AND status = "active"'
      );
      setLowStockCount(lowStockRes[0]?.count || 0);

      const outStockRes = await window.electronAPI.query(
        'SELECT COUNT(*) as count FROM products WHERE quantity = 0 AND status = "active"'
      );
      setOutOfStockCount(outStockRes[0]?.count || 0);

      // 5. Pending approvals count
      const approvalRes = await window.electronAPI.query(
        'SELECT COUNT(*) as count FROM inventory_requests WHERE status = "pending"'
      );
      setPendingApprovals(approvalRes[0]?.count || 0);

      // 6. Cash flow breakdown
      const cashFlowRes = await window.electronAPI.query(
        `SELECT payment_method, SUM(net_amount) as total 
         FROM bills b 
         WHERE ${dateConstraint} 
         GROUP BY payment_method`,
        dateParams
      );
      const flow = { Cash: 0, Card: 0, JazzCash: 0, EasyPaisa: 0 };
      cashFlowRes.forEach(row => {
        if (flow[row.payment_method] !== undefined) {
          flow[row.payment_method] = row.total;
        }
      });
      setCashFlow(flow);

      // 7. Recent Bills Table
      const recentRes = await window.electronAPI.query(
        `SELECT b.*, u.username as cashier 
         FROM bills b 
         JOIN users u ON b.employee_id = u.id 
         ORDER BY b.created_at DESC 
         LIMIT 5`
      );
      setRecentBills(recentRes);

      // 8. Peak Billing Hours (Bar Chart data)
      const hoursRes = await window.electronAPI.query(
        `SELECT strftime('%H', b.created_at) as hour, COUNT(*) as count 
         FROM bills b 
         WHERE ${dateConstraint} 
         GROUP BY hour 
         ORDER BY hour ASC`,
        dateParams
      );
      const hoursLabels = hoursRes.map(r => `${r.hour}:00`);
      const hoursCounts = hoursRes.map(r => r.count);
      setPeakHours({ labels: hoursLabels, data: hoursCounts });

      // 9. Best-Sellers (Pie Chart data)
      const sellerRes = await window.electronAPI.query(
        `SELECT bi.name, SUM(bi.quantity) as sold_qty 
         FROM bill_items bi 
         JOIN bills b ON bi.bill_id = b.id 
         WHERE ${dateConstraint} 
         GROUP BY bi.product_id 
         ORDER BY sold_qty DESC 
         LIMIT 5`,
        dateParams
      );
      const sellerLabels = sellerRes.map(r => r.name);
      const sellerQtys = sellerRes.map(r => r.sold_qty);
      setBestSellers({ labels: sellerLabels, data: sellerQtys });

      // 10. Sales trend line graph (last 7 days of sales)
      const trendRes = await window.electronAPI.query(
        `SELECT date(b.created_at) as day, SUM(net_amount) as total 
         FROM bills b 
         WHERE b.created_at >= date('now', '-7 days') AND b.status = 'active'
         GROUP BY day 
         ORDER BY day ASC`
      );
      const trendLabels = trendRes.map(r => {
        const d = new Date(r.day);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      const trendTotals = trendRes.map(r => r.total);
      setSalesTrend({ labels: trendLabels, data: trendTotals });

    } catch (e) {
      console.error('Failed to query dashboard statistics:', e);
      addNotification('Error loading dashboard analytics.', 'error');
    }
  };

  const applyCustomFilter = () => {
    if (!filterStartDate || !filterEndDate) {
      addNotification('Please select both start and end dates.', 'warning');
      return;
    }
    setIsFilterActive(true);
    addNotification('Date range filter applied.', 'info');
  };

  const resetCustomFilter = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setIsFilterActive(false);
    addNotification('Filters cleared.', 'info');
  };

  // Graph Data Configurations
  const trendChartData = {
    labels: salesTrend.labels.length > 0 ? salesTrend.labels : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Daily Sales (Rs.)',
      data: salesTrend.data.length > 0 ? salesTrend.data : [0, 0, 0, 0, 0, 0, 0],
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 3,
      fill: true,
      tension: 0.3
    }]
  };

  const hoursChartData = {
    labels: peakHours.labels.length > 0 ? peakHours.labels : ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
    datasets: [{
      label: 'Number of Bills',
      data: peakHours.data.length > 0 ? peakHours.data : [0, 0, 0, 0, 0, 0],
      backgroundColor: '#f59e0b',
      borderRadius: 4
    }]
  };

  const doughnutData = {
    labels: ['Cash', 'Card', 'JazzCash', 'EasyPaisa'],
    datasets: [{
      data: [cashFlow.Cash, cashFlow.Card, cashFlow.JazzCash, cashFlow.EasyPaisa],
      backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899'],
      borderWidth: 1
    }]
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* Page Header with Reports Date Filter */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Sales Analytics & Reports</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Real-time business performance metrics</p>
        </div>

        {/* Date Filter Widget */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderRadius: 'var(--radius-sm)' }}>
          <FaCalendarAlt style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            style={{ fontSize: '0.8rem', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 6px', backgroundColor: 'var(--bg-primary)' }}
          />
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>to</span>
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            style={{ fontSize: '0.8rem', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 6px', backgroundColor: 'var(--bg-primary)' }}
          />
          <button onClick={applyCustomFilter} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Apply</button>
          {isFilterActive && (
            <button onClick={resetCustomFilter} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Clear</button>
          )}
        </div>
      </div>

      {/* Real-time statistics summaries */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px'
      }}>
        
        {/* Today's Sales */}
        <div className="standard-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>TODAY'S SALES</span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '6px', color: 'var(--accent-primary)' }}>
              {formatPrice(todaySales)}
            </h2>
          </div>
          <div style={{ fontSize: '2.2rem', color: 'rgba(59, 130, 246, 0.2)' }}><FaRegMoneyBillAlt /></div>
        </div>

        {/* Profit Margin */}
        <div className="standard-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>NET PROFIT</span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '6px', color: 'var(--success)' }}>
              {formatPrice(totalProfit)}
            </h2>
          </div>
          <div style={{ fontSize: '2.2rem', color: 'rgba(16, 185, 129, 0.2)' }}><FaCoins /></div>
        </div>

        {/* Stock Alerts Card */}
        <div 
          className="standard-card" 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            border: lowStockCount > 0 || outOfStockCount > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--border-color)',
            backgroundColor: lowStockCount > 0 || outOfStockCount > 0 ? 'rgba(239, 68, 68, 0.02)' : 'var(--bg-secondary)'
          }}
        >
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>STOCK ALERTS</span>
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-tertiary)' }}>LOW STOCK:</span>
                <span style={{ fontSize: '1.2rem', fontWeight: '800', marginLeft: '4px', color: 'var(--warning)' }}>{lowStockCount}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-tertiary)' }}>OUT OF:</span>
                <span style={{ fontSize: '1.2rem', fontWeight: '800', marginLeft: '4px', color: 'var(--danger)' }}>{outOfStockCount}</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', color: lowStockCount > 0 || outOfStockCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)' }}><FaExclamationTriangle /></div>
        </div>

        {/* Pending approvals notifier */}
        <div 
          className="standard-card" 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            border: pendingApprovals > 0 ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)',
            backgroundColor: pendingApprovals > 0 ? 'rgba(59, 130, 246, 0.02)' : 'var(--bg-secondary)'
          }}
        >
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>PENDING APPROVALS</span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '6px', color: pendingApprovals > 0 ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
              {pendingApprovals} Requests
            </h2>
          </div>
          <div style={{ fontSize: '2.2rem', color: 'rgba(59, 130, 246, 0.2)' }}><FaInbox /></div>
        </div>

      </div>

      {/* Graphs Layout Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px',
        minHeight: '340px'
      }}>
        
        {/* Daily Sales Trend Line Graph */}
        <div className="standard-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '15px' }}><FaChartLine /> Daily Sales Trend (Last 7 Days)</h3>
          <div style={{ height: '260px', width: '100%' }}>
            <Line data={trendChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        {/* Cash Flow Channel breakdown (Doughnut Chart) */}
        <div className="standard-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '15px' }}><FaCoins /> Cash Flow breakdown</h3>
          <div style={{ height: '220px', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
          </div>
        </div>

      </div>

      {/* Lower Dashboard row: Peak Billing Hours and Recent Sales table */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        minHeight: '340px'
      }}>
        
        {/* Peak Hours bar chart */}
        <div className="standard-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '15px' }}><FaTrophy /> Peak Billing Hours (Traffic)</h3>
          <div style={{ height: '260px', width: '100%' }}>
            <Bar data={hoursChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        {/* Recent Bills list */}
        <div className="standard-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '15px' }}><FaUserCheck /> Recent Checkout Sessions</h3>
          <div className="table-container" style={{ flex: 1, border: 'none' }}>
            <table className="custom-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <th style={{ padding: '8px 12px' }}>Bill #</th>
                  <th style={{ padding: '8px 12px' }}>Cashier</th>
                  <th style={{ padding: '8px 12px' }}>Method</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {recentBills.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No bills generated yet</td>
                  </tr>
                ) : (
                  recentBills.map(bill => (
                    <tr key={bill.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px' }}><strong>{bill.bill_number}</strong></td>
                      <td style={{ padding: '10px 12px', textTransform: 'capitalize' }}>{bill.cashier}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: bill.payment_method === 'Cash' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                          color: bill.payment_method === 'Cash' ? 'var(--success)' : 'var(--accent-primary)'
                        }}>
                          {bill.payment_method}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold' }}>Rs. {bill.net_amount.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
