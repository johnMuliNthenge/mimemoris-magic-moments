import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { BookHeart, Users, Calendar, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Index() {
  const { t } = useTranslation();

  const features = [
    { icon: BookHeart, title: 'Capture Memories', desc: 'Record in text, audio, video, or photos' },
    { icon: Users, title: 'Collaborate', desc: 'Share moments with friends and family in real-time' },
    { icon: Calendar, title: 'Relive Moments', desc: 'Look back at how you felt on any date' },
    { icon: Sparkles, title: 'AI-Powered', desc: 'Automatic mood detection and memory analysis' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-warm opacity-10" />
        <div className="container mx-auto px-4 py-20 lg:py-32 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-warm mb-8 shadow-glow">
              <BookHeart className="w-10 h-10 text-primary-foreground" />
            </div>
            <h1 className="font-display text-5xl lg:text-6xl font-bold mb-6">
              {t('app_name')}
            </h1>
            <p className="text-xl text-muted-foreground mb-10">
              {t('app_tagline')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="gradient-warm text-primary-foreground text-lg px-8 shadow-glow">
                <Link to="/auth">{t('signup')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8">
                <Link to="/auth">{t('login')}</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center p-6"
              >
                <div className="w-16 h-16 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2024 {t('app_name')}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
