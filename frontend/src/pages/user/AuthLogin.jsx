import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Mail, Smartphone, Loader2, ArrowLeft } from 'lucide-react';
import {
  useSendOtpMutation,
  useVerifyOtpMutation,
} from '../../features/auth/authApi';
import { setCredentials } from '../../features/auth/authSlice';
import { detectIdentifierType } from '../../utils/detectIdentifier';

const RESEND_SECONDS = 60;

export default function AuthLogin() {
  const navigate = useNavigate();

  const [step, setStep] = useState('identifier');
  const [identifier, setIdentifier] = useState('');
  const [channel, setChannel] = useState(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const [sendOtp, { isLoading: sendingOtp }] = useSendOtpMutation();
  const [verifyOtp, { isLoading: verifyingOtp }] = useVerifyOtpMutation();

  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const t = setInterval(() => setResendTimer((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  const startResendTimer = () => setResendTimer(RESEND_SECONDS);

  const handleSendOtp = useCallback(async (isResend = false) => {
    setError('');
    setSuccess('');
    const detected = detectIdentifierType(identifier);
    if (detected.error) {
      setError(detected.error);
      return;
    }

    try {
      const result = await sendOtp({ identifier: detected.value }).unwrap();
      setChannel(result.channel || detected.type);
      setStep('otp');
      startResendTimer();
      setSuccess(
        isResend
          ? 'OTP resent successfully.'
          : result.message || 'OTP sent successfully.'
      );
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Failed to send OTP.');
    }
  }, [identifier, sendOtp]);

  const dispatch = useDispatch();

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const detected = detectIdentifierType(identifier);
    if (detected.error) {
      setError(detected.error);
      return;
    }

    if (!otp.trim()) {
      setError('Please enter the OTP.');
      return;
    }

    try {
      const result = await verifyOtp({
        identifier: detected.value,
        otp: otp.trim(),
      }).unwrap();

      dispatch(
        setCredentials({
          userId: result.user?.id || result.user?._id,
          user: result.user,
          isCustomer: true,
        })
      );

      setSuccess('Login successful! Redirecting...');
      setTimeout(() => navigate('/shop'), 800);
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Invalid OTP. Please try again.');
    }
  };

  const detected = detectIdentifierType(identifier);
  const channelHint =
    channel === 'mobile'
      ? 'Use OTP 123456 for mobile login (demo).'
      : 'Check your email for the 6-digit OTP.';

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden font-sans bg-[#FFF5E2]">
      <div
        className="absolute inset-0 z-0 opacity-40 bg-repeat bg-center pointer-events-none"
        style={{ backgroundImage: 'url("/Gemini_Generated_Image_me16t6me16t6me16 1 (1).png")', backgroundSize: '600px' }}
      />
      <div className="absolute inset-0 bg-[#FFF5E2]/40 z-[-1]" />

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

      <Link
        to="/shop"
        className="absolute top-6 left-6 md:top-8 md:left-8 w-10 h-10 rounded-full bg-[#85754E]/10 flex items-center justify-center text-[#85754E] border border-[#85754E]/20 no-underline hover:bg-[#85754E]/20 transition-all z-50 shadow-sm"
      >
        <ArrowLeft size={18} />
      </Link>

      <div className="w-[92%] max-w-[420px] bg-white/95 p-8 md:p-12 rounded-[40px] shadow-2xl border border-amber-100/50 z-20 relative backdrop-blur-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full overflow-hidden shadow-xl border-2 border-amber-100 flex items-center justify-center bg-white">
            <img src="/logo.png" alt="Sheetalya" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-3xl font-serif text-slate-800 m-0 tracking-tight">
            {step === 'identifier' ? 'Login / Sign Up' : 'Verify OTP'}
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2 mb-0">
            {step === 'identifier'
              ? 'Email or mobile — we detect automatically'
              : `Sent to your ${channel === 'mobile' ? 'mobile' : 'email'}`}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs mb-4 text-center font-semibold">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-[#85754E] text-xs mb-4 text-center font-semibold">
            {success}
          </div>
        )}

        {step === 'identifier' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendOtp(false);
            }}
            className="flex flex-col gap-5"
          >
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                Email or Mobile Number
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#85754E]">
                  {detected.type === 'mobile' ? (
                    <Smartphone size={18} />
                  ) : (
                    <Mail size={18} />
                  )}
                </div>
                <input
                  type="text"
                  inputMode={detected.type === 'mobile' ? 'numeric' : 'email'}
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="email@example.com or 9876543210"
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900 outline-none transition-all box-border focus:border-[#85754E] focus:ring-4 focus:ring-[#85754E]/5"
                />
              </div>
              {detected.type && (
                <p className="text-[10px] font-bold text-[#85754E] uppercase tracking-widest ml-1 m-0">
                  Detected: {detected.label}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={sendingOtp}
              className="w-full py-4 bg-[#85754E] text-white border-none rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] cursor-pointer flex items-center justify-center gap-2 shadow-2xl shadow-amber-900/30 hover:bg-[#7a6d4a] disabled:opacity-70"
            >
              {sendingOtp ? <Loader2 className="animate-spin" size={18} /> : 'Continue →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-5">
            <p className="text-xs text-slate-500 text-center m-0">{channelHint}</p>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 text-center">
                Enter 6-digit OTP
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                className="w-full py-4 text-center text-2xl font-black tracking-[0.5em] bg-white border border-slate-200 rounded-2xl outline-none focus:border-[#85754E] focus:ring-4 focus:ring-[#85754E]/5"
              />
            </div>

            <button
              type="submit"
              disabled={verifyingOtp || otp.length < 6}
              className="w-full py-4 bg-[#85754E] text-white border-none rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {verifyingOtp ? <Loader2 className="animate-spin" size={18} /> : 'Verify & Login'}
            </button>

            <div className="flex flex-col gap-2 text-center">
              <button
                type="button"
                disabled={resendTimer > 0 || sendingOtp}
                onClick={() => handleSendOtp(true)}
                className="text-xs font-bold text-[#85754E] bg-transparent border-0 cursor-pointer disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('identifier');
                  setOtp('');
                  setError('');
                  setSuccess('');
                }}
                className="text-xs font-bold text-slate-400 bg-transparent border-0 cursor-pointer hover:text-slate-600"
              >
                Change email / mobile
              </button>
            </div>
          </form>
        )}

        <p className="text-center mt-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] m-0">
          Admin panel?{' '}
          <Link to="/" className="text-[#85754E] no-underline hover:underline">
            Admin login
          </Link>
        </p>
      </div>
    </div>
  );
}
