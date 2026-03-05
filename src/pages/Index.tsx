import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  BookHeart, Users, Calendar, Sparkles, MessageCircle,
  Shield, Globe, Camera, Mic, Video, Heart, ArrowRight,
  ChevronDown, Star, Zap, Clock, Lock, Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRef } from 'react';

const easeOut = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: easeOut as unknown as [number, number, number, number] }
  })
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i: number) => ({
    opacity: 1, scale: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: easeOut as unknown as [number, number, number, number] }
  })
};

export default function Index() {
  const { t } = useTranslation();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const captureTypes = [
    { icon: Camera, label: 'Photos', color: 'hsl(var(--primary))' },
    { icon: Video, label: 'Videos', color: 'hsl(var(--accent))' },
    { icon: Mic, label: 'Voice Notes', color: 'hsl(var(--warning))' },
    { icon: MessageCircle, label: 'Texts', color: 'hsl(var(--collab))' },
  ];

  const features = [
    {
      icon: BookHeart,
      title: 'Capture Every Moment',
      desc: 'Text, photos, voice notes, videos — your memories deserve more than just a screenshot. Record how you truly felt.',
    },
    {
      icon: Users,
      title: 'Collaborate in Real-Time',
      desc: 'Invite friends and family to contribute to shared memories. Build your story together, not alone.',
    },
    {
      icon: Sparkles,
      title: 'AI-Powered Insights',
      desc: 'Automatic mood detection, emotion analysis, and smart categorization. Your memories become searchable and meaningful.',
    },
    {
      icon: Calendar,
      title: 'Relive Any Day',
      desc: 'Jump back to any date and see exactly what you felt. A personal time machine for your emotions and experiences.',
    },
    {
      icon: Smartphone,
      title: 'Import from Social Media',
      desc: 'Automatically capture memories from WhatsApp, Telegram, X, TikTok, and Facebook. Just message our number — done.',
    },
    {
      icon: Lock,
      title: 'Private & Secure',
      desc: 'Your memories are encrypted and protected. Set privacy levels, lock memories until a future date, or share publicly.',
    },
  ];

  const howItWorks = [
    { step: '01', title: 'Sign Up Free', desc: 'Create your account in seconds. No credit card required.', icon: Zap },
    { step: '02', title: 'Capture Memories', desc: 'Write, record, snap, or import from your favorite apps.', icon: Heart },
    { step: '03', title: 'Relive & Share', desc: 'Browse your timeline, share with loved ones, or keep them private.', icon: Globe },
  ];

  const testimonials = [
    { name: 'Sarah M.', text: '"I never realized how much I was forgetting until Mimemoris showed me my emotional journey over the past year."', rating: 5 },
    { name: 'James K.', text: '"The WhatsApp integration is genius. I just forward messages and they become beautiful memories."', rating: 5 },
    { name: 'Amara O.', text: '"My family uses the collaboration feature to build shared memories. It\'s brought us closer together."', rating: 5 },
  ];

  const stats = [
    { number: '10K+', label: 'Memories Captured' },
    { number: '50+', label: 'Countries' },
    { number: '4.9★', label: 'User Rating' },
    { number: '99.9%', label: 'Uptime' },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-warm flex items-center justify-center">
              <BookHeart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">{t('app_name')}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">{t('login')}</Link>
            </Button>
            <Button asChild size="sm" className="gradient-warm text-primary-foreground shadow-glow">
              <Link to="/auth">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute top-20 left-[10%] w-72 h-72 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.4), transparent)' }}
            animate={{ scale: [1, 1.2, 1], x: [0, 30, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-20 right-[10%] w-96 h-96 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.4), transparent)' }}
            animate={{ scale: [1.2, 1, 1.2], y: [0, -40, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, hsl(var(--warning) / 0.3), transparent)' }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="container mx-auto px-4 relative">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Memory Keeping</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
              className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6"
            >
              Your Life.{' '}
              <span className="text-gradient">Your Memories.</span>
              <br />
              <span className="text-muted-foreground text-4xl sm:text-5xl lg:text-6xl">Beautifully Preserved.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Stop letting precious moments slip away. Capture memories in text, voice, photos, or video — 
              even import directly from <strong className="text-foreground">WhatsApp, Telegram, X, TikTok</strong> & more. 
              Let AI help you relive how you truly felt.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
            >
              <Button asChild size="lg" className="gradient-warm text-primary-foreground text-lg px-10 h-14 shadow-glow rounded-xl">
                <Link to="/auth" className="flex items-center gap-2">
                  Start Capturing Memories
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-10 h-14 rounded-xl">
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </motion.div>

            {/* Capture type pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="flex flex-wrap justify-center gap-3"
            >
              {captureTypes.map((type, i) => (
                <motion.div
                  key={type.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9 + i * 0.1, duration: 0.4 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-soft"
                >
                  <type.icon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{type.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="w-6 h-6 text-muted-foreground" />
        </motion.div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 border-y border-border bg-card/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
                className="text-center"
              >
                <div className="font-display text-3xl font-bold text-primary">{stat.number}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-16"
          >
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">Features</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to<br />
              <span className="text-gradient">Never Forget Again</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              More than a journal. More than a photo album. Mimemoris is your personal memory vault, powered by AI.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={scaleIn}
                custom={i}
              >
                <Card className="h-full group hover:shadow-glow transition-all duration-500 hover:-translate-y-1 border-border/50 bg-card/80 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-display text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-secondary/30 relative">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-16"
          >
            <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">Simple</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Three Steps to<br />
              <span className="text-gradient">Preserving Your Story</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {howItWorks.map((item, i) => (
              <motion.div
                key={item.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="text-center relative"
              >
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] border-t-2 border-dashed border-primary/20" />
                )}
                <div className="w-24 h-24 mx-auto rounded-2xl gradient-warm flex items-center justify-center mb-6 shadow-glow relative">
                  <item.icon className="w-10 h-10 text-primary-foreground" />
                  <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-card border-2 border-primary text-primary text-xs font-bold flex items-center justify-center">
                    {item.step}
                  </span>
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Import Highlight */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
            >
              <span className="inline-block px-3 py-1 rounded-full bg-collab/10 text-collab text-sm font-medium mb-4">Social Import</span>
              <h2 className="font-display text-3xl sm:text-4xl font-bold mb-6">
                Your Social Chats,<br />
                <span className="text-gradient">Automatically Saved</span>
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                No copy-pasting. No uploading files. Just save our number on WhatsApp or Telegram, 
                and forward any message. It instantly becomes a memory in your timeline, 
                linked to your account automatically.
              </p>
              <ul className="space-y-3 mb-8">
                {['WhatsApp — Forward messages to our number', 'Telegram — Chat with our bot', 'X, TikTok, Facebook — Coming soon'].map((item, i) => (
                  <motion.li
                    key={item}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    custom={i + 1}
                    className="flex items-center gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                      <Star className="w-3 h-3 text-success" />
                    </div>
                    <span className="text-sm">{item}</span>
                  </motion.li>
                ))}
              </ul>
              <Button asChild className="gradient-warm text-primary-foreground shadow-glow rounded-xl">
                <Link to="/auth" className="flex items-center gap-2">
                  Try It Now <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={scaleIn}
              custom={0}
              className="relative"
            >
              {/* Phone mockup */}
              <div className="relative mx-auto w-72 sm:w-80">
                <div className="bg-card rounded-[2.5rem] border-[6px] border-foreground/10 p-4 shadow-2xl">
                  <div className="w-24 h-1 bg-foreground/10 rounded-full mx-auto mb-4" />
                  <div className="space-y-3 min-h-[400px]">
                    <div className="bg-primary/10 rounded-2xl rounded-tl-sm p-3 max-w-[80%]">
                      <p className="text-xs font-medium text-primary mb-1">WhatsApp Import</p>
                      <p className="text-sm">Just had the best dinner with the family! 🎉</p>
                      <p className="text-[10px] text-muted-foreground mt-1">7:32 PM</p>
                    </div>
                    <div className="bg-accent/10 rounded-2xl rounded-tl-sm p-3 max-w-[80%]">
                      <p className="text-xs font-medium text-accent mb-1">Auto-detected mood</p>
                      <p className="text-sm">😊 Happy • Family • Celebration</p>
                    </div>
                    <div className="bg-success/10 rounded-2xl rounded-tr-sm p-3 max-w-[80%] ml-auto">
                      <p className="text-xs font-medium text-success mb-1">✓ Memory Saved</p>
                      <p className="text-sm">Added to your March 5 timeline</p>
                    </div>
                    <div className="bg-collab/10 rounded-2xl rounded-tl-sm p-3 max-w-[80%]">
                      <p className="text-xs font-medium text-collab mb-1">Telegram Import</p>
                      <p className="text-sm">Road trip to the coast! 🏖️</p>
                      <p className="text-[10px] text-muted-foreground mt-1">2:15 PM</p>
                    </div>
                    <div className="bg-success/10 rounded-2xl rounded-tr-sm p-3 max-w-[80%] ml-auto">
                      <p className="text-xs font-medium text-success mb-1">✓ Memory Saved</p>
                      <p className="text-sm">Mood: Excited • Travel</p>
                    </div>
                  </div>
                </div>
                {/* Floating badges */}
                <motion.div
                  className="absolute -left-4 top-20 bg-card border border-border rounded-xl px-3 py-2 shadow-soft"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <span className="text-xs font-medium">📱 WhatsApp</span>
                </motion.div>
                <motion.div
                  className="absolute -right-4 top-40 bg-card border border-border rounded-xl px-3 py-2 shadow-soft"
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <span className="text-xs font-medium">✈️ Telegram</span>
                </motion.div>
                <motion.div
                  className="absolute -left-2 bottom-32 bg-card border border-border rounded-xl px-3 py-2 shadow-soft"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity }}
                >
                  <span className="text-xs font-medium">🎵 TikTok</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-secondary/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-16"
          >
            <span className="inline-block px-3 py-1 rounded-full bg-warning/10 text-warning text-sm font-medium mb-4">Loved by Users</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold">
              What People Are <span className="text-gradient">Saying</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <Card className="h-full border-border/50 bg-card/80">
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-warning text-warning" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed italic">{t.text}</p>
                    <p className="font-display font-semibold text-sm">{t.name}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-warm opacity-5" />
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-warm mb-8 shadow-glow">
              <Heart className="w-10 h-10 text-primary-foreground" />
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Your Memories Deserve<br />
              <span className="text-gradient">To Be Remembered</span>
            </h2>
            <p className="text-muted-foreground mb-10 text-lg">
              Join thousands of people who are preserving their most precious moments. Start free today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="gradient-warm text-primary-foreground text-lg px-10 h-14 shadow-glow rounded-xl">
                <Link to="/auth" className="flex items-center gap-2">
                  Get Started — It's Free
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">No credit card required • Free plan available forever</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-warm flex items-center justify-center">
                <BookHeart className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold">{t('app_name')}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {t('app_name')}. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Login</Link>
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign Up</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
