import React, { useState, useEffect, useRef } from 'react';
import { X, Settings, Check, User, Calendar, Mail, Phone, AtSign, Sparkles, Sliders, ShieldCheck, ExternalLink, Camera, Upload, Trash2, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { api } from '../services/api';
import { MAJOR_CURRENCIES } from '../utils/currencyHelper';

export const SettingsModal = ({ isOpen, onClose }) => {
  const { user, updateUserSettings } = useAuth();
  const { currency: globalCurrency, setCurrency: setGlobalCurrency } = useCurrency();
  const isAdmin = user?.role === 'admin';

  // Profile Fields
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [securityPin, setSecurityPin] = useState('');
  const [tradingExperience, setTradingExperience] = useState('Intermediate');
  const [avatar, setAvatar] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState(false);
  const fileInputRef = useRef(null);

  // Trading & System Settings
  const [currency, setCurrency] = useState('USD');
  const [riskPerTrade, setRiskPerTrade] = useState(1);
  const [defaultInstrument, setDefaultInstrument] = useState('EURUSD');
  const [aiProvider, setAiProvider] = useState('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gemini-3.8-flash');

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'trading' | 'ai'
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state whenever modal opens or user data changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUserId(user.userId || '');
      setDob(user.dob || '');
      setEmail(user.email || '');
      setPhoneNumber(user.phoneNumber || '');
      setSecurityPin(user.hasSecurityPin ? '••••' : '');
      setTradingExperience(user.tradingExperience || 'Intermediate');
      setAvatar(user.avatar || '');
      setCurrency(globalCurrency || user.settings?.currency || 'USD');
      setRiskPerTrade(user.settings?.riskPerTrade ?? 1);
      setDefaultInstrument(user.settings?.defaultInstrument || 'EURUSD');
      setAiProvider(user.settings?.aiProvider || 'gemini');
      setGeminiApiKey(user.settings?.geminiApiKey || '');
      setAiApiKey(user.settings?.aiApiKey || '');
      setAiModel(user.settings?.aiModel || 'gemini-3.8-flash');
      setErrorMsg('');
      setPhotoSuccess(false);
    }
  }, [user, isOpen]);

  // Process & compress uploaded image file into centered square
  const processImageFile = (file) => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select an image file (PNG, JPG, WEBP)'));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error('Image is too large. Please select an image under 10MB'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const targetSize = 256;
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');

          // Centered square crop
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize);
          const compressedDataUrl = canvas.toDataURL('image/webp', 0.88);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image file'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file from disk'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setErrorMsg('');
    try {
      const compressedDataUrl = await processImageFile(file);
      let finalAvatarUrl = compressedDataUrl;

      // Try uploading to Cloudinary CDN if configured
      try {
        const uploadRes = await api.uploadImage(compressedDataUrl);
        if (uploadRes?.url) {
          finalAvatarUrl = uploadRes.url;
        }
      } catch (cloudErr) {
        // Fall back gracefully to direct base64 data URL
        console.info('Cloudinary direct storage fallback active');
      }

      setAvatar(finalAvatarUrl);
      await updateUserSettings({ avatar: finalAvatarUrl });
      setPhotoSuccess(true);
      setTimeout(() => setPhotoSuccess(false), 2500);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    setUploadingPhoto(true);
    setErrorMsg('');
    try {
      setAvatar('');
      await updateUserSettings({ avatar: '' });
      setPhotoSuccess(true);
      setTimeout(() => setPhotoSuccess(false), 2500);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to remove photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      const updatedSettings = {
        currency,
        riskPerTrade: Number(riskPerTrade),
        defaultInstrument,
        aiModel
      };

      if (isAdmin) {
        updatedSettings.aiProvider = aiProvider;
        updatedSettings.geminiApiKey = geminiApiKey;
        updatedSettings.aiApiKey = aiApiKey;
      }

      const updatePayload = {
        name: name.trim(),
        userId: userId.trim(),
        dob: dob.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        tradingExperience,
        avatar,
        settings: updatedSettings
      };

      if (securityPin.trim() && securityPin.trim() !== '••••' && securityPin.trim() !== '****') {
        if (!/^\d{4}$/.test(securityPin.trim())) {
          setErrorMsg('Security PIN must be exactly 4 digits (e.g. 1234)');
          setSaving(false);
          return;
        }
        updatePayload.securityPin = securityPin.trim();
      }

      const updatedUser = await updateUserSettings(updatePayload);
      setSecurityPin(updatedUser?.hasSecurityPin || user?.hasSecurityPin ? '••••' : '');
      if (updatedUser?.hasSecurityPin || updatePayload.securityPin) {
        const userKey = user?._id || user?.id || user?.userId || 'current_user';
        localStorage.setItem(`tradejourn_pin_set_${userKey}`, 'true');
      }

      setGlobalCurrency(currency);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 210, 255, 0.15)', border: '1px solid rgba(0, 210, 255, 0.3)', display: 'grid', placeItems: 'center' }}>
              <Settings size={18} color="var(--accent-cyan)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800' }}>Trader Profile & Account Settings</h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Manage your personal identity, photo, risk parameters, and AI coach configuration</p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '6px', padding: '12px 0 6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              fontWeight: '700',
              border: 'none',
              background: activeTab === 'profile' ? 'var(--accent-cyan)' : 'transparent',
              color: activeTab === 'profile' ? '#060c14' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <User size={14} />
            <span>Profile & Identity</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('trading')}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              fontWeight: '700',
              border: 'none',
              background: activeTab === 'trading' ? 'var(--accent-cyan)' : 'transparent',
              color: activeTab === 'trading' ? '#060c14' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Sliders size={14} />
            <span>Trading & Risk</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              fontWeight: '700',
              border: 'none',
              background: activeTab === 'ai' ? 'var(--accent-cyan)' : 'transparent',
              color: activeTab === 'ai' ? '#060c14' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={14} />
            <span>AI Coach</span>
          </button>
        </div>

        {errorMsg && (
          <div style={{ padding: '10px 14px', background: 'rgba(255, 77, 77, 0.15)', border: '1px solid rgba(255, 77, 77, 0.4)', borderRadius: 'var(--radius-sm)', color: '#ff7373', fontSize: '0.84rem', marginTop: '12px' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px', overflowY: 'auto', padding: '16px 2px 4px 2px' }}>
          {/* TAB 1: Profile & Personal Details */}
          {activeTab === 'profile' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Profile Photo Upload Card */}
              <div className="profile-photo-card" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-medium)',
                position: 'relative',
                flexWrap: 'wrap'
              }}>
                {/* Photo Preview Circle */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(0, 245, 155, 0.25), rgba(0, 210, 255, 0.25))',
                    border: '2px solid var(--accent-cyan)',
                    display: 'grid',
                    placeItems: 'center',
                    overflow: 'hidden',
                    boxShadow: '0 4px 16px rgba(0, 210, 255, 0.2)',
                    color: 'var(--profit)',
                    fontSize: '1.6rem',
                    fontWeight: '800'
                  }}>
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={name || 'Trader Avatar'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : name ? (
                      name.charAt(0).toUpperCase()
                    ) : (
                      <User size={30} />
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    style={{
                      position: 'absolute',
                      bottom: '-4px',
                      right: '-4px',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: 'var(--accent-cyan)',
                      border: '2px solid var(--bg-surface)',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      color: '#060c14',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      transition: 'transform 0.15s ease'
                    }}
                    title="Choose photo from device"
                    aria-label="Choose photo"
                  >
                    <Camera size={13} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Trader Name & Upload Action */}
                <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-white)' }}>
                      {name || user?.name || user?.username || 'Trader'}
                    </h4>
                    {photoSuccess && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--profit)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} strokeWidth={3} /> Photo Updated!
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="btn-secondary"
                      style={{
                        padding: '7px 14px',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '8px'
                      }}
                    >
                      {uploadingPhoto ? (
                        <>
                          <Loader2 size={13} className="spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={13} color="var(--accent-cyan)" />
                          <span>{avatar ? 'Change Photo' : 'Upload Photo'}</span>
                        </>
                      )}
                    </button>

                    {avatar && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={uploadingPhoto}
                        className="btn-ghost"
                        style={{
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          color: 'var(--loss)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                        title="Remove custom photo and use letter avatar"
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-grid-2">
                <label>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={13} color="var(--accent-cyan)" />
                    <span>Trader Full Name</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Suman Singh"
                  />
                </label>

                <label>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AtSign size={13} color="var(--accent-cyan)" />
                    <span>Trader Handle / User ID</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    placeholder="@abc123"
                  />
                </label>
              </div>

              <div className="form-grid-2">
                <label>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={13} color="var(--accent-cyan)" />
                    <span>Email Address</span>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="trader@tradejourn.com"
                  />
                </label>

                <label>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={13} color="var(--accent-cyan)" />
                    <span>Mobile / Phone (OTP & Password Recovery)</span>
                  </span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="+911234******"
                  />
                </label>
              </div>

              <div className="form-grid-2">
                <label>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={13} color="var(--accent-cyan)" />
                    <span>Date of Birth (DOB)</span>
                  </span>
                  <input
                    type="date"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                  />
                </label>

                <label>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={13} color="var(--profit)" />
                    <span>Trading Experience Level</span>
                  </span>
                  <select
                    value={tradingExperience}
                    onChange={e => setTradingExperience(e.target.value)}
                  >
                    <option value="Beginner">Beginner (0 - 1 years, mastering risk & setups)</option>
                    <option value="Intermediate">Intermediate (1 - 3 years, prop challenge scaling)</option>
                    <option value="Expert">Expert (3+ years, funded institutional management)</option>
                  </select>
                </label>
              </div>

              <div className="form-grid-2">
                <label style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <KeyRound size={13} color="var(--accent-cyan)" />
                      <span>4-Digit Security PIN (Password Recovery)</span>
                    </span>
                    {user?.hasSecurityPin ? (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'var(--profit)',
                          background: 'rgba(0, 245, 155, 0.1)',
                          border: '1px solid rgba(0, 245, 155, 0.25)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Check size={11} strokeWidth={3} /> PIN Set (••••)
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: '#f59e0b',
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          padding: '2px 8px',
                          borderRadius: '12px'
                        }}
                      >
                        Not Set
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={securityPin === '••••' ? 'text' : 'password'}
                      maxLength={4}
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      value={securityPin}
                      onFocus={() => {
                        if (securityPin === '••••') {
                          setSecurityPin('');
                        }
                      }}
                      onChange={e => setSecurityPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder={user?.hasSecurityPin ? "••••" : "Set 4-digit PIN (e.g. 1234)"}
                      style={{
                        letterSpacing: securityPin === '••••' ? '6px' : 'normal',
                        fontFamily: securityPin === '••••' ? 'monospace' : 'inherit',
                        fontSize: securityPin === '••••' ? '1.05rem' : 'inherit'
                      }}
                      autoComplete="off"
                    />
                    {user?.hasSecurityPin && securityPin === '••••' && (
                      <button
                        type="button"
                        onClick={() => setSecurityPin('')}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '6px',
                          color: 'var(--accent-cyan)',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '3px 8px'
                        }}
                      >
                        Change PIN
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                    {user?.hasSecurityPin
                      ? "4-digit PIN is active (shown as ••••). To change your PIN, click 'Change PIN' or type a new 4-digit PIN above."
                      : "Used to instantly reset your password via the login screen without needing an external OTP."}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: Trading & Risk Parameters */}
          {activeTab === 'trading' && (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div className="form-grid-2">
                <label>
                  <span>Account Currency</span>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}>
                    {MAJOR_CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol}) — {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Default Risk % Per Trade</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={riskPerTrade ?? ''}
                    onFocus={(e) => e.target.select()}
                    onChange={e => {
                      let val = e.target.value;
                      if (typeof val === 'string' && /^0[0-9]+/.test(val)) {
                        val = val.replace(/^0+/, '');
                      }
                      setRiskPerTrade(val);
                    }}
                  />
                </label>
              </div>

              <label>
                <span>Default / Primary Instrument</span>
                <input
                  type="text"
                  value={defaultInstrument}
                  onChange={e => setDefaultInstrument(e.target.value)}
                  placeholder="EURUSD, XAUUSD, BTCUSD..."
                />
              </label>
            </div>
          )}

          {/* TAB 3: AI Coach Settings */}
          {activeTab === 'ai' && (
            <div style={{ display: 'grid', gap: '14px' }}>
              {isAdmin ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '700' }}>AI Provider:</span>
                      <button
                        type="button"
                        className={aiProvider === 'gemini' ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => {
                          setAiProvider('gemini');
                          if (!aiModel.startsWith('gemini')) setAiModel('gemini-3.8-flash');
                        }}
                        style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: 'var(--radius-pill)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Sparkles size={12} /> Google Gemini (Free)
                      </button>
                      <button
                        type="button"
                        className={aiProvider === 'openai' ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => {
                          setAiProvider('openai');
                          if (aiModel.startsWith('gemini')) setAiModel('gpt-4o-mini');
                        }}
                        style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: 'var(--radius-pill)' }}
                      >
                        OpenAI (GPT-4o)
                      </button>
                    </div>

                    {aiProvider === 'gemini' && (
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '0.76rem', color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                      >
                        Get Free Gemini Key <ExternalLink size={11} />
                      </a>
                    )}
                  </div>

                  <label>
                    <span>{aiProvider === 'gemini' ? 'Google Gemini API Key (Global Admin Key)' : 'OpenAI API Key (Global Admin Key)'}</span>
                    <input
                      type="password"
                      placeholder={aiProvider === 'gemini' ? 'AIzaSy... (Paste free Gemini key)' : 'sk-proj-...'}
                      value={aiProvider === 'gemini' ? geminiApiKey : aiApiKey}
                      onChange={e => aiProvider === 'gemini' ? setGeminiApiKey(e.target.value) : setAiApiKey(e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <div
                  style={{
                    background: 'rgba(0, 245, 155, 0.08)',
                    border: '1px solid rgba(0, 245, 155, 0.25)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <Sparkles size={18} color="var(--profit)" />
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-white)' }}>
                      Managed AI Coaching Enabled
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      AI service is pre-configured by administrators. Select your preferred model below.
                    </div>
                  </div>
                </div>
              )}

              <label>
                <span>Selected AI Model</span>
                <select value={aiModel} onChange={e => setAiModel(e.target.value)}>
                  <option value="gemini-3.8-flash">⚡ gemini-3.8-flash (Latest Fast & Free - Recommended)</option>
                  <option value="gemini-3.8-pro">🧠 gemini-3.8-pro (Deep Institutional Reasoning)</option>
                  <option value="gemini-3.5-flash">⚡ gemini-3.5-flash (High Speed)</option>
                  <option value="auto">🔄 Auto-Detect (Best Available for Engine)</option>
                  {isAdmin && (
                    <>
                      <option value="gpt-4o-mini">gpt-4o-mini (Faster, cost-effective)</option>
                      <option value="gpt-4o">gpt-4o (Deep hedge-fund reasoning)</option>
                    </>
                  )}
                </select>
              </label>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Logged in as <strong style={{ color: 'var(--text-white)' }}>{user?.userId || user?.name}</strong>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saved ? <><Check size={16} /> Saved Successfully</> : saving ? 'Saving Profile...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
