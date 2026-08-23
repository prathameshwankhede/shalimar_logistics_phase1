// src/components/TransFlowAIChatbot.jsx
// Smart Logistics AI Assistant Chatbot for Transporters & Admin 🤖🚚

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bot, MessageSquare, X, Send, Sparkles, Truck, DollarSign, MapPin, ShieldCheck, ChevronRight, RefreshCw, FileText } from 'lucide-react';

export const TransFlowAIChatbot = () => {
  const { db, currentUser, currentTransporter } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState([
    {
      id: 'welcome_1',
      sender: 'bot',
      text: `Namaste! 👋 Main **TransFlow AI Assistant** hu. Main aapki rate requests, live bid notifications, dispatch status, SAP PO numbers, payment stage, aur plant loading rules me instant madad kar sakta hu. Aap niche suggestion click kar sakte hain ya apna sawal type karein! 🚚✨`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const lastProcessedSubIdRef = useRef((db.rate_submissions || [])[0]?.id || null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadCount(0);
    }
  }, [messages, isOpen]);

  // 📡 100% Deterministic Real-Time Bidding Watcher & Instant AI Chat Message Alert Engine
  useEffect(() => {
    const currentSubmissions = db.rate_submissions || [];
    const latestSub = currentSubmissions[0];

    if (latestSub && latestSub.id !== lastProcessedSubIdRef.current) {
      lastProcessedSubIdRef.current = latestSub.id;

      const req = (db.rate_requests || []).find((r) => r.id === latestSub?.rate_request_id);
      const transporter = (db.transporters || []).find((t) => t.id === latestSub?.transporter_id);

      const transName = transporter?.company_name || 'Transporter';
      const reqTitle = req?.title || req?.request_no || 'Requirement';
      const routeStr = req ? `${req.origin_city} ➔ ${req.dest_city}` : 'Freight Route';
      const rateVal = latestSub?.rate_per_unit ? Number(latestSub.rate_per_unit).toLocaleString() : '0';
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const notificationMsg = {
        id: `bid_alert_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        sender: 'bot',
        text: `🚨 📡 **LIVE NEW BID ALERT RECEIVED!**\n\n• **Transporter**: **${transName}**\n• **Route**: 📍 ${routeStr}\n• **Submitted Quote**: 💰 **₹${rateVal}/MT**\n• **Indent Ref**: ${reqTitle}\n• **Logged Time**: ${timeStr}\n\n👉 Admin Panel me **"Compare Rates"** tab par click karke lowest L1 bid freeze & contract award karein! 🚀`,
        timestamp: timeStr,
        isNotification: true
      };

      setMessages((prev) => [...prev, notificationMsg]);
      setUnreadCount((prev) => prev + 1);
    }
  }, [db.rate_submissions]);

  const isAdmin = currentUser?.role === 'admin';
  const { updateDB } = useAuth();
  const [activeChatTab, setActiveChatTab] = useState('ai'); // 'ai' or 'live_admin'
  const [directInputText, setDirectInputText] = useState('');

  const currentTransId = currentTransporter?.id || 'VTL001';
  const directMessages = (db.direct_messages || []).filter((m) => 
    isAdmin ? true : (m.transporter_id === currentTransId || m.transporter_name === currentTransporter?.company_name)
  ).reverse();

  const unreadAdminDirectMsgs = (db.direct_messages || []).filter((m) => 
    isAdmin ? (!m.is_read_by_admin) : (m.transporter_id === currentTransId && m.sender === 'admin' && !m.is_read_by_transporter)
  ).length;

  const handleSendDirectMessage = (e) => {
    if (e) e.preventDefault();
    const textToSend = directInputText.trim();
    if (!textToSend) return;

    const newMsg = {
      id: `direct_msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      transporter_id: currentTransporter?.id || 'vtl001',
      transporter_name: currentTransporter?.company_name || currentUser?.username || 'Transporter',
      sender: isAdmin ? 'admin' : 'transporter',
      sender_name: isAdmin ? 'Shalimar Logistics Admin' : (currentTransporter?.company_name || currentUser?.username || 'Transporter'),
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      created_at: Date.now(),
      is_read_by_admin: isAdmin,
      is_read_by_transporter: !isAdmin
    };

    const updatedDb = {
      ...db,
      direct_messages: [newMsg, ...(db.direct_messages || [])]
    };
    updateDB(updatedDb);
    setDirectInputText('');
    setTimeout(scrollToBottom, 100);
  };

  // Smart AI Intent Parser & Live DB Resolver
  const generateBotResponse = (userQuery) => {
    const q = (userQuery || "").toLowerCase();

    // 1. Open Requirements & Active Bidding Query
    if (q.includes('open') || q.includes('requirement') || q.includes('active') || q.includes('rate') || q.includes('route') || q.includes('bidding') || q.includes('bid')) {
      const openReqs = (db.rate_requests || []).filter((r) => r.status === 'Open');
      if (openReqs.length === 0) {
        return `📍 **Active Open Requirements**: Abhi filhal koi new open requirement pending nahi hai. Admin dwara new indents broadcast hote hi aapko alert mil jayega! 🔔`;
      }
      const list = openReqs.slice(0, 3).map((r, idx) => 
        `**${idx + 1}. ${r.request_no}**: 📍 ${r.origin_city} ➔ 🎯 **${r.dest_city}** (${r.required_qty ? Number(r.required_qty).toLocaleString() : 0} MT ${r.material_type})`
      ).join('\n');

      return `📍 **Total Open Requirements (${openReqs.length})**:\n\n${list}\n\n👉 Aap Transporter Portal ke **"Open Requirements"** tab par jaakar 1-line quote fill kar sakte hain! ⚡`;
    }

    // 2. Payment & Advance Status Query
    if (q.includes('pay') || q.includes('payment') || q.includes('money') || q.includes('paisa') || q.includes('advance') || q.includes('balance') || q.includes('bank')) {
      if (isAdmin) {
        const totalValue = (db.contracts || []).reduce((acc, c) => acc + (c.total_contract_value || 0), 0);
        return `💳 **Consolidated Enterprise Payment Summary**:\n\n• **Total Contract Liability**: ₹${(totalValue || 0).toLocaleString()}\n• **Standard Terms**: 70% Advance on LR Truck Dispatch & 30% Balance Settlement post Unloading.\n• **ERP SAP PO Sync**: Active 🛡️`;
      }

      const myTransId = currentTransporter?.id;
      const myContracts = (db.contracts || []).filter((c) => c.transporter_id === myTransId || (c.contract_number && currentTransporter?.code && c.contract_number.includes(currentTransporter.code)));

      if (myContracts.length === 0) {
        return `💳 **Payment & Account Status**: Aapke company (**${currentTransporter?.company_name}**) ke paas abhi koi active contract billing log nahi hai. Jab aapko tender award hoga, tab 70% advance instantly release kar diya jayega!`;
      }

      const contractList = myContracts.slice(0, 3).map((c) => 
        `• **${c.contract_number}** (SAP PO: ${c.erp_po_number}): Status **${c.payment_status}**`
      ).join('\n');

      return `💳 **Aapke Active Contracts (${myContracts.length}) Payment Details**:\n\n${contractList}\n\n👉 Standard Terms: 70% Advance on Dispatch + 30% Balance post Unloading.`;
    }

    // 3. Truck Dispatch & Delivery Order (DO) Status Query
    if (q.includes('truck') || q.includes('dispatch') || q.includes('lr') || q.includes('driver') || q.includes('do') || q.includes('gate')) {
      const dispatches = db.truck_dispatches || [];
      if (dispatches.length === 0) {
        return `🚛 **Truck Dispatch Status**: Abhi tak portal par koi truck LR entry recorded nahi hai. Awarded Contracts tab me **"➕ Add Dispatch / LR"** click karke truck number log karein!`;
      }

      const latest = dispatches[0];
      return `🚛 **Latest Truck Dispatch Entry**:\n\n• **Truck Number**: ${latest.truck_number}\n• **Driver**: ${latest.driver_name} (${latest.driver_phone})\n• **LR Number**: ${latest.lr_number}\n• **Qty**: ${latest.dispatched_qty} MT\n• **Status**: ${latest.status} 🟢`;
    }

    // 4. Plant Loading & Tarpaulin Rules Query
    if (q.includes('rule') || q.includes('plant') || q.includes('tarp') || q.includes('seal') || q.includes('weighbridge') || q.includes('midc') || q.includes('term')) {
      return `📜 **Shalimar Nutrients Official Plant Transport Rules**:\n\n1. ⛺ **Dry Bagged Cargo**: Sound food-grade double tarpaulin covering mandatory.\n2. 🛢️ **Liquid Oil Tankers**: Stainless steel food-grade tankers with tamper-evident single-use seals required.\n3. ⚖️ **Weighbridge**: 24x7 automated tare & gross weight logging at Shalimar MIDC Plant.\n4. ⏱️ **Unloading Time**: Expected within 4 hours of arrival at refinery.`;
    }

    // 5. Admin Contact & Help Query
    if (q.includes('admin') || q.includes('contact') || q.includes('phone') || q.includes('call') || q.includes('help') || q.includes('support')) {
      return `📞 **Shalimar Logistics Head Contact**:\n\n• **Company**: Shalimar Nutrients Pvt Ltd\n• **Office**: Plot 12, MIDC Industrial Area, Nagpur, MH\n• **Email**: logistics@shalimarnutrients.com\n• **Phone**: +91 712 2567890 / +91 98765 43210`;
    }

    // Default Smart Response
    return `Main aapki baat samajh gaya hu! 🤖 Aap niche kisi bhi option par click karke details dekh sakte hain:\n\n• Type **"Open"**: Active open requirements\n• Type **"Payment"**: Check 70% advance & 30% balance stage\n• Type **"Dispatch"**: Track LR truck numbers\n• Type **"Rules"**: Plant tarpaulin & loading rules`;
  };

  const handleSendMessage = (textToSend = inputText) => {
    if (!textToSend.trim()) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const botAnswerText = generateBotResponse(textToSend);
      const botMsg = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: botAnswerText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <>
      {/* Floating Chatbot Launcher Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setUnreadCount(0);
        }}
        className="btn-primary"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          borderRadius: '50px',
          padding: '12px 20px',
          boxShadow: '0 10px 25px rgba(2, 132, 199, 0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.88rem',
          fontWeight: '700',
          border: '2px solid rgba(255,255,255,0.2)'
        }}
      >
        <Bot size={20} className="pulse-slow" />
        <span>TransFlow Assistant</span>
        {(unreadCount > 0 || unreadAdminDirectMsgs > 0) && (
          <span
            style={{
              background: '#ef4444',
              color: '#ffffff',
              borderRadius: '20px',
              padding: '2px 8px',
              fontSize: '0.72rem',
              fontWeight: '900',
              animation: 'pulse 1.5s infinite'
            }}
          >
            🔴 +{unreadCount + unreadAdminDirectMsgs}
          </span>
        )}
      </button>

      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'fixed',
            bottom: '84px',
            right: '24px',
            width: '380px',
            height: '540px',
            maxHeight: '80vh',
            zIndex: 9999,
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            border: '1.5px solid var(--border-color)',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)'
          }}
        >
          {/* Chat Header with Dual-Mode Tabs */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              padding: '12px 16px',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bot size={20} />
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: '#ffffff' }}>TransFlow Logistics Desk</h3>
                  <span style={{ fontSize: '0.68rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span> Live Online Sync
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', opacity: 0.8 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '10px' }}>
              <button
                onClick={() => setActiveChatTab('ai')}
                style={{
                  flex: 1,
                  padding: '6px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  background: activeChatTab === 'ai' ? '#ffffff' : 'transparent',
                  color: activeChatTab === 'ai' ? '#0284c7' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                🤖 AI Assistant
              </button>
              <button
                onClick={() => setActiveChatTab('live_admin')}
                style={{
                  flex: 1,
                  padding: '6px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  background: activeChatTab === 'live_admin' ? '#ffffff' : 'transparent',
                  color: activeChatTab === 'live_admin' ? '#0284c7' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                💬 Live Admin Chat
                {unreadAdminDirectMsgs > 0 && (
                  <span style={{ position: 'absolute', top: '-2px', right: '4px', background: '#ef4444', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '0.62rem' }}>
                    {unreadAdminDirectMsgs}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: AI ASSISTANT CHAT */}
          {activeChatTab === 'ai' && (
            <>
              {/* Chat Stream */}
              <div
                style={{
                  flex: 1,
                  padding: '14px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '85%',
                        padding: '10px 14px',
                        borderRadius: m.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                        background: m.sender === 'user'
                          ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)'
                          : 'rgba(30, 41, 59, 0.75)',
                        color: '#ffffff',
                        fontSize: '0.84rem',
                        lineHeight: '1.45',
                        border: m.sender === 'user' ? 'none' : '1px solid var(--border-color)',
                        whiteSpace: 'pre-line'
                      }}
                    >
                      {m.text}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {m.timestamp}
                    </span>
                  </div>
                ))}

                {isTyping && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '0.78rem', fontStyle: 'italic' }}>
                    <Bot size={14} /> AI typing...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Suggestion Chips */}
              <div
                style={{
                  padding: '8px 12px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  gap: '6px',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap'
                }}
              >
                <button
                  onClick={() => handleSendMessage('What are active open requirements?')}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: '20px' }}
                >
                  📍 Open Requirements
                </button>
                <button
                  onClick={() => handleSendMessage('Check my payment and advance status')}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: '20px' }}
                >
                  💳 Payment Status
                </button>
                <button
                  onClick={() => handleSendMessage('What are plant loading rules?')}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: '20px' }}
                >
                  📜 Plant Rules
                </button>
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                style={{
                  padding: '10px 12px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  background: 'var(--bg-card)'
                }}
              >
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ask AI (e.g. Open bids, Payment, Rules)..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: '0.82rem', borderRadius: '10px' }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '8px 14px', borderRadius: '10px' }}
                >
                  <Send size={15} />
                </button>
              </form>
            </>
          )}

          {/* TAB 2: LIVE ADMIN DIRECT MESSAGING */}
          {activeChatTab === 'live_admin' && (
            <>
              {/* Direct Messages Stream */}
              <div
                style={{
                  flex: 1,
                  padding: '14px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '10px', padding: '10px', fontSize: '0.75rem', color: '#38bdf8', textAlign: 'center' }}>
                  💬 <strong>Shalimar Logistics Desk Live Chat</strong><br />
                  Aapki queries direct Admin logistics desk par real-time message hongi.
                </div>

                {directMessages.map((m) => {
                  const isMe = (isAdmin && m.sender === 'admin') || (!isAdmin && m.sender === 'transporter');
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: '800',
                          color: isMe ? '#38bdf8' : '#fbbf24',
                          marginBottom: '2px'
                        }}
                      >
                        {m.sender_name || (m.sender === 'admin' ? 'Shalimar Admin' : 'Transporter')}
                      </div>
                      <div
                        style={{
                          maxWidth: '85%',
                          padding: '10px 14px',
                          borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                          background: isMe
                            ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                            : 'rgba(30, 41, 59, 0.85)',
                          color: '#ffffff',
                          fontSize: '0.84rem',
                          lineHeight: '1.45',
                          border: isMe ? 'none' : '1px solid rgba(251, 191, 36, 0.3)',
                          whiteSpace: 'pre-line'
                        }}
                      >
                        {m.text}
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {m.timestamp}
                      </span>
                    </div>
                  );
                })}

                {directMessages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px', fontSize: '0.82rem' }}>
                    Abhi tak koi message nahi hai. Shalimar Admin ko direct message bhejne ke liye niche type karein! 💬
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Direct Chat Input Bar */}
              <form
                onSubmit={handleSendDirectMessage}
                style={{
                  padding: '10px 12px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  background: 'var(--bg-card)'
                }}
              >
                <input
                  type="text"
                  className="form-control"
                  placeholder="Type message to Shalimar Admin..."
                  value={directInputText}
                  onChange={(e) => setDirectInputText(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: '0.82rem', borderRadius: '10px' }}
                />
                <button
                  type="submit"
                  className="btn btn-success"
                  style={{ padding: '8px 14px', borderRadius: '10px' }}
                >
                  <Send size={15} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
};
