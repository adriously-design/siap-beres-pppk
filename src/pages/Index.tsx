import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, Youtube, Instagram } from "lucide-react";
import heroImage from "@/assets/hero-recruitment.jpg";
import logoNTT from "@/assets/logo-ntt.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src={logoNTT} 
                alt="Logo Provinsi NTT" 
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="font-bold text-lg">SIAP BERES</h1>
                <p className="text-xs opacity-90">Sistem Informasi Administrasi PPPK Berbasis Digital</p>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/auth-pppk')}
              variant="secondary"
              size="lg"
            >
              Login PPPK
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/20 via-background to-secondary/20 py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
                Selamat Datang di Portal PPPK
              </h2>
              <p className="text-xl text-muted-foreground">
                Sistem Informasi Administrasi PPPK Berbasis Digital untuk Provinsi Nusa Tenggara Timur
              </p>
              <div className="flex gap-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate('/auth-pppk')}
                  className="text-lg px-8"
                >
                  Login Calon PPPK
                </Button>
              </div>
            </div>
            <div className="relative">
              <img 
                src={heroImage} 
                alt="PPPK Portal" 
                className="rounded-2xl shadow-2xl w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">Fitur Layanan</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="text-xl font-semibold text-center">Upload Dokumen</h4>
                <p className="text-muted-foreground text-center">
                  Upload dan kelola dokumen persyaratan PPPK dengan mudah dan aman
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h4 className="text-xl font-semibold text-center">Verifikasi Dokumen</h4>
                <p className="text-muted-foreground text-center">
                  Pantau status verifikasi dokumen secara real-time dengan notifikasi otomatis
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h4 className="text-xl font-semibold text-center">E-Bimtek</h4>
                <p className="text-muted-foreground text-center">
                  Akses materi bimbingan teknis secara online kapan saja dan dimana saja
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground mt-auto">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h5 className="text-xl font-bold">BKD Provinsi Nusa Tenggara Timur</h5>
              <p className="text-sm opacity-90">
                Bidang Perencanaan, Pendidikan dan Sistem Informasi Pegawai
              </p>
              <p className="text-sm opacity-90">
                Jln. Raya El Tari No.52 Oebobo Kupang<br/>
                Kel. Oebobo, Kec. Kota Raja, Kota Kupang, Nusa Tenggara Tim. 85111
              </p>
            </div>
            <div className="space-y-4">
              <h5 className="text-xl font-bold">Hubungi Kami</h5>
              <div className="flex flex-col gap-3">
                <a 
                  href="https://wa.me/6282299395149" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Phone className="w-5 h-5" />
                  <span className="text-sm">WhatsApp: +62 822-9939-5149</span>
                </a>
                <a 
                  href="mailto:pengaduanpppk2024@gmail.com"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Mail className="w-5 h-5" />
                  <span className="text-sm">pengaduanpppk2024@gmail.com</span>
                </a>
                <a 
                  href="https://www.youtube.com/c/BadanKepegawaianDaerahProvinsiNTT" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Youtube className="w-5 h-5" />
                  <span className="text-sm">YouTube BKD Provinsi NTT</span>
                </a>
                <a 
                  href="https://www.instagram.com/bkdprovinsintt/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Instagram className="w-5 h-5" />
                  <span className="text-sm">@bkdprovinsintt</span>
                </a>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-primary-foreground/20 text-center text-sm opacity-75">
            © 2025 - Sub Bidang Perencanaan Formasi
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
