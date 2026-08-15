import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { useAdminAuth } from './AdminAuth.jsx';
import { Banner, Button, Field, Input } from './components.jsx';
import { EASE } from '../lib/motion.js';

export default function Login() {
  const { admin, checking, login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const destination = location.state?.from?.pathname ?? '/admin';

  useEffect(() => {
    if (!checking && admin) navigate(destination, { replace: true });
  }, [admin, checking, destination, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bloom-100 px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE }}
        className="w-full max-w-md"
      >
        <div className="text-center">
          <Link to="/" className="font-display text-2xl text-moss-800">
            The Little Blooming Farm
          </Link>
          <p className="mt-2 font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted">
            Owner access
          </p>
        </div>

        <form onSubmit={submit} className="mt-10 border border-bloom-300 bg-bloom-50 p-8" noValidate>
          {error && <Banner tone="clay">{error.message}</Banner>}

          <Field label="Email" className="mb-6">
            <Input
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Password">
            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Button type="submit" disabled={submitting} className="mt-9 w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-7 text-center font-sans text-[12px] font-light leading-relaxed text-ink-faint">
          Sessions last eight hours and are locked to this browser. After eight failed attempts an
          account is locked for fifteen minutes.
        </p>
      </motion.div>
    </div>
  );
}
