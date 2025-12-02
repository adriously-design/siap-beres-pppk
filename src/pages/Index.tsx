import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Mail, Phone, Youtube, Instagram, FileUp, FileCheck2, Presentation } from "lucide-react";
import heroImage from "@/assets/pppk0.jpeg";
import heroImage1 from "@/assets/pppk1.jpg";
import heroImage2 from "@/assets/pppk2.jpg";
import logoNTT from "@/assets/logo-ntt.png";
import { ThemeToggle } from "@/components/ThemeToggle";
const Index = () => {
  const navigate = useNavigate();
  const plugin = React.useRef(
    Autoplay({ delay: 3000, stopOnInteraction: true })
  );

  const carouselImages = [
    {
      src: heroImage,
      alt: "PPPK Tahap1",
    },
    {
      src: heroImage1,
      alt: "PPPK Tahap1-2",
    },
    {
      src: heroImage2,
      alt: "PPPK Tahap1-3",
    },
  ];

  return <div className="min-h-screen flex flex-col">
    {/* Navbar */}
    <nav className="bg-primary text-primary-foreground shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoNTT} alt="Logo Provinsi NTT" className="w-12 h-12 object-contain" />
            <div>
              <h1 className="font-bold text-lg">SIAP BERES</h1>
              <p className="opacity-90 text-sm">Sistem Informasi Administrasi PPPK - Berkas Sesuai</p>
            </div>
          </div>
          <Button onClick={() => window.open('https://bkd.nttprov.go.id/', '_blank')} variant="secondary" size="lg">
            Website BKD NTT
          </Button>
        </div>
      </div>
    </nav>

    {/* Hero Section */}
    <section className="relative bg-gradient-to-br from-primary/20 via-background to-secondary/20 py-20">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight overflow-hidden">
              <span className="inline-block animate-slide-in-right">
                Selamat Datang di Portal PPPK
              </span>
            </h2>
            <p className="text-xl text-muted-foreground">Sistem Informasi Administrasi PPPK Berbasis Digital untuk PPPK di Lingkup Provinsi Nusa Tenggara Timur</p>
            <div className="flex gap-4">
              <Button size="lg" onClick={() => navigate('/auth-pppk')} className="text-lg px-8">
                Login Calon PPPK
              </Button>
            </div>
          </div>
          <div className="relative flex items-center justify-center">
            <Carousel
              plugins={[plugin.current]}
              className="w-full max-w-lg"
              onMouseEnter={plugin.current.stop}
              onMouseLeave={plugin.current.reset}
            >
              <CarouselContent>
                {carouselImages.map((image, index) => (
                  <CarouselItem key={index}>
                    <div className="p-1">
                      <img src={image.src} alt={image.alt} className="rounded-2xl shadow-2xl w-full h-auto aspect-video object-cover" />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="absolute left-4" />
              <CarouselNext className="absolute right-4" />
            </Carousel>
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
                <FileUp className="w-8 h-8 text-primary" />
              </div>
              <h4 className="text-xl font-semibold text-center">Upload Dokumen</h4>
              <p className="text-muted-foreground text-center">Upload dan kelola dokumen persyaratan pengusulan NI PPPK dengan mudah dan aman</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <FileCheck2 className="w-8 h-8 text-primary" />
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
                <Presentation className="w-8 h-8 text-primary" />
              </div>
              <h4 className="text-xl font-semibold text-center">E-Bimtek</h4>
              <p className="text-muted-foreground text-center">Akses panduan teknis secara online kapan saja dan dimana saja</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>

    {/* Footer */}
    <footer className="bg-primary text-primary-foreground mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <h5 className="text-xl font-bold">BKD Provinsi Nusa Tenggara Timur</h5>
            <p className="text-sm opacity-100">
              Bidang Perencanaan, Pendidikan dan Sistem Informasi Pegawai
            </p>
            <p className="text-sm opacity-100">
              Jln. Raya El Tari No.52 Oebobo Kupang<br />
              Kel. Oebobo, Kec. Kota Raja, Kota Kupang, Nusa Tenggara Tim. 85111
            </p>
          </div>
          <div className="space-y-4">
            <h5 className="text-xl font-bold">Hubungi Kami</h5>
            <div className="flex flex-col gap-3">
              <a href="https://wa.me/6282299395149" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Phone className="w-5 h-5" />
                <span className="text-sm">WhatsApp: +62 822-9939-5149</span>
              </a>
              <a href="mailto:pengaduanpppk2024@gmail.com" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Mail className="w-5 h-5" />
                <span className="text-sm">pengaduanpppk2024@gmail.com</span>
              </a>
              <a href="https://www.youtube.com/c/BadanKepegawaianDaerahProvinsiNTT" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Youtube className="w-5 h-5" />
                <span className="text-sm">YouTube BKD Provinsi NTT</span>
              </a>
              <a href="https://www.instagram.com/bkdprovinsintt/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Instagram className="w-5 h-5" />
                <span className="text-sm">@bkdprovinsintt</span>
              </a>
            </div>
          </div>
          <div className="space-y-4">
            <h5 className="text-xl font-bold">Lokasi Kami</h5>
            <p className="text-sm opacity-100">
              Badan Kepegawaian Daerah Provinsi NTT
            </p>
            <div className="overflow-hidden rounded-lg shadow-lg aspect-video">
              <iframe
                src="https://maps.google.com/maps?q=Badan%20Kepegawaian%20Daerah%20Provinsi%20Nusa%20Tenggara%20Timur&t=&z=15&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Lokasi BKD Provinsi NTT"
              ></iframe>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-primary-foreground/20 flex justify-between items-center text-sm opacity-75">
          <span>© 2025 - Bidang Perencanaan, Pendidikan dan SIstem Informasi Pegawai</span>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  </div>;
};
export default Index;