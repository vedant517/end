import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Mail,
  Smartphone,
  User,
  Loader2,
  ArrowLeft,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  useSendRegisterEmailOtpMutation,
  useVerifyRegisterEmailOtpMutation,
} from '../../features/auth/authApi';

const RESEND_SECONDS = 60;

// ── tiny helpers ───────────────────────────────────────────────────────────────
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isValidPhone = (v) => /^[6-9]\d{9}$/.test(v.trim());

export default function Register() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // OTP step
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('form'); // 'form' | 'otp' | 'done'
  const [emailVerified, setEmailVerified] = useState(false);

  // feedback
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const [sendOtp, { isLoading: sending }] = useSendRegisterEmailOtpMutation();
  const [verifyOtp, { isLoading: verifying }] = useVerifyRegisterEmailOtpMutation();

  // resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const t = setInterval(() => setResendTimer((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  // ── validate form fields before sending OTP ──────────────────────────────
  const validateForm = () => {
    if (!name.trim()) return 'Please enter your full name.';
    if (!isValidEmail(email)) return 'Please enter a valid email address.';
    if (!isValidPhone(phone)) return 'Please enter a valid 10-digit mobile number.';
    return null;
  };

  // ── Step 1 → send OTP ────────────────────────────────────────────────────
  const handleSendOtp = useCallback(
    async (isResend = false) => {
      setError('');
      setSuccess('');

      if (!isResend) {
        const err = validateForm();
        if (err) { setError(err); return; }
      }

      try {
        await sendOtp({ name: name.trim(), email: email.trim(), phonenum: phone.trim() }).unwrap();
        setStep('otp');
        setResendTimer(RESEND_SECONDS);
        setSuccess(isResend ? 'OTP resent to your email.' : 'OTP sent to your email. Please check your inbox.');
      } catch (err) {
        setError(err?.data?.message || err?.message || 'Failed to send OTP. Please try again.');
      }
    },
    [name, email, phone, sendOtp]
  );

  // ── Step 2 → verify OTP & register ──────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (otp.length < 6) { setError('Please enter the 6-digit OTP.'); return; }

    try {
      const result = await verifyOtp({
        name: name.trim(),
        email: email.trim(),
        phonenum: phone.trim(),
        otp: otp.trim(),
      }).unwrap();

      setEmailVerified(true);
      setStep('done');
      setSuccess(result.message || 'Email verified! Registration successful.');

      // Navigate to shop after short delay
      setTimeout(() => navigate('/shop'), 2000);
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Invalid OTP. Please try again.');
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden font-sans bg-[#FFF5E2]">

      {/* bg pattern */}
      <div
        className="absolute inset-0 z-0 opacity-40 bg-repeat bg-center pointer-events-none"
        style={{
          backgroundImage: 'url("/Gemini_Generated_Image_me16t6me16t6me16 1 (1).png")',
          backgroundSize: '600px',
        }}
      />

      {/* decorative saree images */}
      <img
        src="/592a97f2-d897-4a51-9b02-b82b0bf80e02 1.png"
        alt=""
        className="hidden xl:block absolute left-[-5%] bottom-[-5%] h-[90vh] object-contain z-10 pointer-events-none select-none opacity-90"
      />
      <img
        src="/c31efe28-8d51-4c48-a47f-ede28a6bbb2f 1.png"
        alt=""
        className="hidden xl:block absolute right-[-5%] bottom-[-5%] h-[85vh] object-contain z-10 pointer-events-none select-none opacity-90"
      />

      {/* back arrow */}
      <Link
        to="/login"
        className="absolute top-6 left-6 md:top-8 md:left-8 w-10 h-10 rounded-full bg-[#85754E]/10 flex items-center justify-center text-[#85754E] border border-[#85754E]/20 no-underline hover:bg-[#85754E]/20 transition-all z-50 shadow-sm"
      >
        <ArrowLeft size={18} />
      </Link>

      {/* card */}
      <div className="w-[92%] max-w-[440px] bg-white/95 p-8 md:p-10 rounded-[40px] shadow-2xl border border-amber-100/50 z-20 relative backdrop-blur-md">

        {/* logo + title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full overflow-hidden shadow-xl border-2 border-amber-100 flex items-center justify-center bg-white">
            <img src="/logo.png" alt="Sheetalya" className="w-14 h-14 object-contain" />
          </div>

          <h1 className="text-3xl font-serif text-slate-800 m-0 tracking-tight">
            {step === 'form' && 'Create Account'}
            {step === 'otp'  && 'Verify Email'}
            {step === 'done' && 'All Set! 🎉'}
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2 mb-0">
            {step === 'form' && 'Fill in your details to get started'}
            {step === 'otp'  && `OTP sent to ${email}`}
            {step === 'done' && 'Your email is verified'}
          </p>
        </div>

        {/* alerts */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs mb-4 text-center font-semibold">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-[#85754E] text-xs mb-4 text-center font-semibold flex items-center justify-center gap-2">
            <CheckCircle size={14} />
            {success}
          </div>
        )}

        {/* ── STEP 1: FORM ── */}
        {step === 'form' && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendOtp(false); }}
            className="flex flex-col gap-5"
          >
            {/* Name */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                Full Name
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#85754E]">
                  <User size={18} />
                </div>
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900 outline-none transition-all box-border focus:border-[#85754E] focus:ring-4 focus:ring-[#85754E]/5"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#85754E]">
                  <Mail size={18} />
                </div>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900 outline-none transition-all box-border focus:border-[#85754E] focus:ring-4 focus:ring-[#85754E]/5"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                Mobile Number
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#85754E]">
                  <Smartphone size={18} />
                </div>
                <input
                  id="reg-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900 outline-none transition-all box-border focus:border-[#85754E] focus:ring-4 focus:ring-[#85754E]/5"
                />
              </div>
            </div>

            {/* Send OTP button */}
            <button
              id="reg-send-otp"
              type="submit"
              disabled={sending}
              className="w-full py-4 bg-[#85754E] text-white border-none rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] cursor-pointer flex items-center justify-center gap-2 shadow-2xl shadow-amber-900/30 hover:bg-[#7a6d4a] disabled:opacity-70 transition-colors"
            >
              {sending ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <Mail size={15} /> Send OTP to Email
                </>
              )}
            </button>

            <p className="text-center mt-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] m-0">
              Already have an account?{' '}
              <Link to="/login" className="text-[#85754E] no-underline hover:underline">
                Login
              </Link>
            </p>
          </form>
        )}

        {/* ── STEP 2: OTP VERIFICATION ── */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5">
            {/* info box */}
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-100 text-center">
              <Mail className="mx-auto mb-2 text-[#85754E]" size={22} />
              <p className="text-xs text-slate-600 m-0">
                We sent a <span className="font-bold text-[#85754E]">6-digit OTP</span> to
              </p>
              <p className="text-sm font-black text-slate-800 mt-1 m-0 break-all">{email}</p>
            </div>

            {/* OTP input */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 text-center">
                Enter 6-digit OTP
              </label>
              <input
                id="reg-otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                className="w-full py-4 text-center text-2xl font-black tracking-[0.5em] bg-white border border-slate-200 rounded-2xl outline-none focus:border-[#85754E] focus:ring-4 focus:ring-[#85754E]/5 transition-all"
              />
            </div>

            {/* Verify button */}
            <button
              id="reg-verify-otp"
              type="submit"
              disabled={verifying || otp.length < 6}
              className="w-full py-4 bg-[#85754E] text-white border-none rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] cursor-pointer flex items-center justify-center gap-2 shadow-2xl shadow-amber-900/30 hover:bg-[#7a6d4a] disabled:opacity-70 transition-colors"
            >
              {verifying ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <ShieldCheck size={15} /> Verify &amp; Register
                </>
              )}
            </button>

            {/* resend + back */}
            <div className="flex flex-col gap-2 text-center">
              <button
                type="button"
                id="reg-resend-otp"
                disabled={resendTimer > 0 || sending}
                onClick={() => handleSendOtp(true)}
                className="text-xs font-bold text-[#85754E] bg-transparent border-0 cursor-pointer disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('form'); setOtp(''); setError(''); setSuccess(''); }}
                className="text-xs font-bold text-slate-400 bg-transparent border-0 cursor-pointer hover:text-slate-600"
              >
                ← Change details
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 3: SUCCESS / VERIFIED ── */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-6 py-4">
            {/* animated tick */}
            <div className="relative flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-green-50 border-4 border-green-400 flex items-center justify-center animate-pulse">
                <CheckCircle className="text-green-500" size={48} />
              </div>
            </div>

            {/* Mail Verified badge */}
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-50 border border-green-200 shadow-sm">
              <ShieldCheck className="text-green-600" size={16} />
              <span className="text-sm font-black text-green-700 uppercase tracking-wider">
                Mail Verified
              </span>
            </div>

            <div className="text-center space-y-1">
              <p className="text-slate-700 font-semibold text-sm m-0">
                Welcome, <span className="text-[#85754E]">{name}</span>!
              </p>
              <p className="text-slate-400 text-xs m-0">
                Your account has been created. Redirecting to shop…
              </p>
            </div>

            {/* email info */}
            <div className="w-full p-4 rounded-2xl bg-amber-50 border border-amber-100 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Mail size={14} className="text-[#85754E]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verified Email</span>
              </div>
              <p className="text-sm font-bold text-slate-800 m-0 break-all">{email}</p>
            </div>

            <button
              onClick={() => navigate('/shop')}
              className="w-full py-4 bg-[#85754E] text-white border-none rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] cursor-pointer flex items-center justify-center gap-2 shadow-2xl shadow-amber-900/30 hover:bg-[#7a6d4a] transition-colors"
            >
              Go to Shop →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
