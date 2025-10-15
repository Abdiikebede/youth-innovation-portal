import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublicNavbar } from "@/components/public-navbar";
import { PublicFooter } from "@/components/public-footer";
import { api } from "@/services/api";
import { StatsResponse } from "@shared/api";
import {
  Users,
  Award,
  Star,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Zap,
  Globe,
  Target,
  BarChart3,
  Rocket,
  Shield,
  Calendar,
  Code,
  Brain,
  Heart,
  Sparkles,
  Phone,
  Mail,
  Facebook,
  Twitter,
  Linkedin,
  Youtube,
  Send,
} from "lucide-react";

export default function PublicLanding() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const features = [
    {
      title: "Innovation Hub",
      description:
        "Connect with like-minded innovators and collaborate on groundbreaking projects",
      icon: Users,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
    },
    {
      title: "Technology Transfer",
      description:
        "Facilitate the transfer of cutting-edge technology to drive economic growth and innovation",
      icon: Rocket,
      color: "from-violet-500 to-purple-500",
      bgColor: "bg-violet-50 dark:bg-violet-950/20",
    },
    {
      title: "Digitalization",
      description:
        "Transform traditional processes through digital innovation and smart technology solutions",
      icon: Zap,
      color: "from-cyan-500 to-blue-500",
      bgColor: "bg-cyan-50 dark:bg-cyan-950/20",
    },
    {
      title: "Expert Mentorship",
      description:
        "Get guidance from industry experts and successful entrepreneurs",
      icon: Star,
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
    },
    {
      title: "Funding Access",
      description:
        "Access grants and investment opportunities for your innovative ideas",
      icon: TrendingUp,
      color: "from-emerald-500 to-green-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
    },
    {
      title: "Certification",
      description:
        "Earn certificates and badges for your innovation achievements",
      icon: Award,
      color: "from-purple-500 to-indigo-500",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
    },
  ];

  const displayStats = stats ? [
    { number: stats.verifiedUsers.toString(), label: "Active Innovators", icon: Users },
    { number: stats.publishedProjects.toString(), label: "Projects Launched", icon: Rocket },
    { number: `${stats.successRate}%`, label: "Success Rate", icon: Target },
    { number: stats.upcomingEvents.toString(), label: "Upcoming Events", icon: BarChart3 },
  ] : [];



  const ALLOWED_SECTORS = ["Education", "Technology", "Agriculture", "Health"] as const;
  const sectorIcons: Record<typeof ALLOWED_SECTORS[number], any> = {
    Education: Brain,
    Technology: Code,
    Agriculture: Globe,
    Health: Heart,
  };

  const sectors = stats
    ? stats.sectors
        .filter((s) => (ALLOWED_SECTORS as readonly string[]).includes(s.name))
        .map((sector) => {
          const Icon = sectorIcons[sector.name as typeof ALLOWED_SECTORS[number]] || Code;
          return {
            name: sector.name,
            icon: Icon,
            projects: sector.count.toString(),
          };
        })
    : [];

  return (
    <div className="min-h-screen bg-white text-black">
      <PublicNavbar />

      {/* Top contact header (fixed below existing heading, no search) */}
      <div className="fixed inset-x-0 top-14 md:top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm bg-white/95 supports-[backdrop-filter]:bg-white/75 backdrop-blur border border-black/10 rounded-md py-2 px-3 shadow-sm">
            {/* Phone + Email */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-black/80">
                <Phone className="h-4 w-4 text-[#2e9891]" />
                <span className="font-medium">+251118132191</span>
              </div>
              <div className="hidden md:flex items-center gap-2 text-black/80">
                <Mail className="h-4 w-4 text-[#2e9891]" />
                <a href="mailto:contact@mint.gov.et" className="font-medium text-[#2e9891]">
                  contact@mint.gov.et
                </a>
              </div>
            </div>
            {/* Social icon buttons */}
            <div className="flex items-center gap-2">
              <a aria-label="Facebook" href="https://www.facebook.com/MInT.Ethiopia" target="_blank" rel="noopener noreferrer" className="grid place-items-center h-9 w-9 rounded-full bg-white hover:opacity-90 text-white shadow transition">
                <svg className="h-4 w-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a aria-label="Twitter" href="#" target="_blank" rel="noopener noreferrer" className="grid place-items-center h-9 w-9 rounded-full bg-white hover:opacity-90 text-white shadow transition">
                <Twitter className="h-4 w-4 text-[#1DA1F2]" />
              </a>
              <a aria-label="LinkedIn" href="https://www.linkedin.com/company/ministry-of-innovation-and-technology-ethiopia/" target="_blank" rel="noopener noreferrer" className="grid place-items-center h-9 w-9 rounded-full bg-white hover:opacity-90 text-white shadow transition">
                <Linkedin className="h-4 w-4 text-[#0A66C2]" />
              </a>
              <a aria-label="Telegram" href="#" target="_blank" rel="noopener noreferrer" className="grid place-items-center h-9 w-9 rounded-full bg-white hover:opacity-90 text-white shadow transition">
                <Send className="h-4 w-4 text-[#26A5E4]" />
              </a>
              <a aria-label="YouTube" href="https://www.youtube.com/@MinistryofInnovationandTechnol" target="_blank" rel="noopener noreferrer" className="grid place-items-center h-9 w-9 rounded-full bg-white hover:opacity-90 text-white shadow transition">
                <svg className="h-4 w-4 text-[#FF0000]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
      {/* Spacer so fixed bar doesn't overlap content */}
      <div className="h-14 md:h-16" />

      {/* Hero Section with Enhanced Design */}
      <section className="relative pt-24 pb-16 overflow-hidden bg-white">
        {/* Background minimal */}
        <div className="absolute inset-0"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-8 lg:space-y-12">
            {/* Logo */}
            <div className="flex justify-center mb-2">
              <img
                src="http://www.mint.gov.et/o/adaptive-media/image/260066/Preview-1000x0/logo24+%282%29.png?t=1743885360726"
                alt="Logo"
                className="h-20 md:h-24 lg:h-28 w-auto"
              />
            </div>

            {/* Title below logo */}
            <h2
              className="text-4xl md:text-6xl font-extrabold tracking-tight mt-2 bg-gradient-to-r from-[#3c999e] to-emerald-600 bg-clip-text text-transparent drop-shadow-sm"
            >
              MinT Innovation Portal
            </h2>

            {/* Subtitle (formal paragraph) */}
            <p className="max-w-3xl mx-auto text-base md:text-lg lg:text-xl leading-8 text-black/80 font-normal text-center md:text-left mt-2">
              Welcome to Ethiopia’s official innovation portal, operated by the Ministry of Innovation and Technology.
              The platform provides access to national programs, expert mentorship, technology transfer services,
              and funding opportunities to support innovators from idea to implementation. Use this portal to
              develop, validate, and present impactful solutions that contribute to Ethiopia’s sustainable
              development and digital transformation.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="bg-[#2e9891] hover:bg-[#277f79] text-white px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
                onClick={() => navigate("/register")}
              >
                Start Your Journey
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-[#2e9891] px-8 py-6 text-lg font-semibold hover:bg-[#2e9891] hover:text-white hover:border-[#2e9891]"
                onClick={() => navigate("/login")}
              >
                Sign In
              </Button>
              {/* About Us button removed from hero; now placed on navbar */}
            </div>

            {/* Platform Statistics */}
            {stats && (
              <div className="pt-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {displayStats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <div key={index} className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          <Icon className="h-5 w-5 text-black mr-2" />
                          <span className="text-2xl md:text-3xl font-bold text-black">
                            {stat.number}
                          </span>
                        </div>
                        <p className="text-sm text-black/70">
                          {stat.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* About Section moved near footer; simplified */}

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="text-black border-black/30">
              Why Choose Us?
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold">
              Everything you need to
              <span className="text-black"> innovate & grow</span>
            </h2>
            <p className="text-xl text-black/70 max-w-3xl mx-auto">
              Comprehensive tools, technology transfer, digitalization support, and community
              collaboration to transform your innovative ideas into impactful solutions for Ethiopia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="group hover:shadow-xl transition-all duration-300 border border-black/10 bg-white"
                >
                  <CardContent className="p-8 text-center space-y-4">
                    <div
                      className={`mx-auto w-16 h-16 bg-black/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Icon className="h-8 w-8 text-black" />
                    </div>
                    <h3 className="text-xl font-semibold group-hover:text-black transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-black/70 leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Innovation Sectors */}
      {stats && sectors.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <Badge variant="outline" className="text-black border-black/30">
                Innovation Sectors
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold">
                Driving change across
                <span className="text-black"> key sectors</span>
              </h2>
              <p className="text-xl text-black/70 max-w-3xl mx-auto">
                From healthcare to agriculture, our innovators are solving
                Ethiopia's most pressing challenges.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {sectors.map((sector, index) => {
                const Icon = sector.icon;
                return (
                  <Card
                    key={index}
                    className="group hover:shadow-lg transition-all duration-300 cursor-pointer bg-white border border-black/10"
                  >
                    <CardContent className="p-6 text-center space-y-3">
                      <div className="mx-auto w-12 h-12 bg-black/5 rounded-xl flex items-center justify-center group-hover:bg-black transition-colors duration-300">
                        <Icon className="h-6 w-6 text-black group-hover:text-white transition-colors duration-300" />
                      </div>
                      <h3 className="font-semibold text-sm">{sector.name}</h3>
                      <p className="text-xs text-black/70">
                        {sector.projects} projects
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      )}





      {/* About Section (final, simplified) placed above footer */}
      <section id="about" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-8">
            <Badge variant="outline" className="text-black border-black/30">About Us</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Ministry of Innovation and Technology Ethiopia</h2>
          </div>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-black/80 leading-7">
              The MinT Innovation Portal is the official platform of Ethiopia’s Ministry of Innovation and Technology.
              We empower innovators, startups, researchers, and institutions with programs, mentorship,
              technology transfer, and funding opportunities to accelerate impactful solutions across the nation.
            </p>
         
            <div className="mt-6">
              <Button variant="outline" onClick={() => window.open('http://www.mint.gov.et', '_blank')}>Official Website</Button>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
