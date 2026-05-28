import React, { useState } from 'react';
import bcrypt from 'bcryptjs';
import { FaUser, FaLock, FaGlobe, FaEye, FaEyeSlash } from 'react-icons/fa';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState('en');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError(language === 'ur' ? 'براہ کرم تمام فیلڈز پُر کریں۔' : 'Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Query the user from the database
      const sql = 'SELECT * FROM users WHERE username = ? AND status = "active"';
      const rows = await window.electronAPI.query(sql, [username.trim().toLowerCase()]);
      
      if (rows && rows.length > 0) {
        const user = rows[0];
        // Compare password hash
        const isPasswordCorrect = bcrypt.compareSync(password, user.password_hash);
        
        if (isPasswordCorrect) {
          // Parse permissions JSON
          let permissions = [];
          try {
            permissions = JSON.parse(user.permissions);
          } catch (e) {
            console.error('Failed to parse permissions:', e);
          }

          const loggedInUser = {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: permissions
          };
          
          // Log user activity
          const logQuery = 'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)';
          await window.electronAPI.run(logQuery, [user.id, 'login', `User logged in from desktop session.`]);
          
          // Call success callback
          onLoginSuccess(loggedInUser, language);
        } else {
          setError(language === 'ur' ? 'غلط پاس ورڈ۔ دوبارہ کوشش کریں۔' : 'Incorrect password. Please try again.');
        }
      } else {
        // Double check if account is locked
        const checkLocked = 'SELECT * FROM users WHERE username = ? AND status = "locked"';
        const lockedRows = await window.electronAPI.query(checkLocked, [username.trim().toLowerCase()]);
        if (lockedRows && lockedRows.length > 0) {
          setError(language === 'ur' ? 'یہ اکاؤنٹ لاک ہے۔ برائے مہربانی ایڈمن سے رابطہ کریں۔' : 'This employee account is locked. Please contact the Admin/Owner.');
        } else {
          setError(language === 'ur' ? 'صارف کا نام نہیں ملا۔' : 'Username not found or account disabled.');
        }
      }
    } catch (err) {
      console.error('Login process error:', err);
      setError(language === 'ur' ? 'ڈیٹا بیس کنکشن کا مسئلہ۔' : 'Database connection error.');
    } finally {
      setLoading(false);
    }
  };

  const isUrdu = language === 'ur';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at center, var(--bg-tertiary) 0%, var(--bg-primary) 100%)',
      padding: '20px'
    }}>
      <div 
        className="glass-card" 
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '40px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-premium)',
          backgroundColor: 'var(--bg-glass)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}
      >
        {/* Language Selector */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
          <FaGlobe style={{ color: 'var(--text-tertiary)' }} />
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            style={{ 
              fontSize: '0.8rem', 
              fontWeight: '700', 
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              border: 'none',
              background: 'none'
            }}
          >
            <option value="en">English</option>
            <option value="ur">اردو (Urdu)</option>
          </select>
        </div>

        {/* Branding header */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ 
            fontSize: '1.8rem', 
            fontWeight: '800', 
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #a855f7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '4px'
          }}>
            {isUrdu ? 'بیکری بلنگ سسٹم' : 'Bakery POS'}
          </h1>
          <p style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
            {isUrdu ? 'محفوظ لاگ ان اور انوینٹری مینجمنٹ' : 'Secure Billing & Inventory Management'}
          </p>
        </div>

        {error && (
          <div 
            className="pulse-red" 
            style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.2)', 
              color: 'var(--danger)', 
              padding: '12px 16px', 
              borderRadius: 'var(--radius-sm)', 
              fontSize: '0.85rem',
              fontWeight: '600',
              textAlign: isUrdu ? 'right' : 'left',
              direction: isUrdu ? 'rtl' : 'ltr'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Username Input */}
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label" style={{ direction: isUrdu ? 'rtl' : 'ltr' }}>
              <span>{isUrdu ? 'صارف کا نام (Username)' : 'Username'}</span>
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <span style={{ 
                position: 'absolute', 
                left: isUrdu ? 'auto' : '16px', 
                right: isUrdu ? '16px' : 'auto', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center'
              }}>
                <FaUser />
              </span>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isUrdu ? 'صارف کا نام درج کریں' : 'Enter username'}
                className="input-field" 
                style={{ 
                  paddingLeft: isUrdu ? '16px' : '44px',
                  paddingRight: isUrdu ? '44px' : '16px',
                  textAlign: isUrdu ? 'right' : 'left',
                  direction: isUrdu ? 'rtl' : 'ltr'
                }}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label" style={{ direction: isUrdu ? 'rtl' : 'ltr' }}>
              <span>{isUrdu ? 'پاس ورڈ (Password)' : 'Password'}</span>
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <span style={{ 
                position: 'absolute', 
                left: isUrdu ? 'auto' : '16px', 
                right: isUrdu ? '16px' : 'auto', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                zIndex: 10
              }}>
                <FaLock />
              </span>
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isUrdu ? 'اپنا پاس ورڈ درج کریں' : 'Enter password'}
                className="input-field" 
                style={{ 
                  paddingLeft: isUrdu ? '40px' : '44px',
                  paddingRight: isUrdu ? '44px' : '40px',
                  textAlign: isUrdu ? 'right' : 'left',
                  direction: isUrdu ? 'rtl' : 'ltr'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: isUrdu ? 'auto' : '16px',
                  left: isUrdu ? '16px' : 'auto',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  zIndex: 10
                }}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary"
            style={{ 
              marginTop: '10px', 
              height: '50px',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? (
              isUrdu ? 'لوڈنگ...' : 'Verifying Session...'
            ) : (
              isUrdu ? 'لاگ ان کریں' : 'Access System'
            )}
          </button>
        </form>

        {/* Offline Security Footer Notice */}
        <div style={{ textAlign: 'center', fontSize: '0.725rem', color: 'var(--text-tertiary)', marginTop: '8px' }}>
          <span>{isUrdu ? 'مکمل آف لائن انکرپٹڈ سیشن' : 'Fully offline local session. Protected by SHA-256.'}</span>
        </div>
      </div>
    </div>
  );
}
