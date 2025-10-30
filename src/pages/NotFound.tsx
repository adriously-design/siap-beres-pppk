import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-blue-50 to-white text-center">
      {/* Angka 404 jatuh dari atas */}
      <motion.h1
        className="text-[10rem] font-extrabold text-blue-600 drop-shadow-lg"
        initial={{ y: -300, opacity: 0, rotate: -10 }}
        animate={{
          y: [0, 10, -8, 5, -3, 0],
          opacity: 1,
          rotate: [0, 2, -2, 1, -1, 0],
        }}
        transition={{
          type: "spring",
          stiffness: 120,
          damping: 8,
          duration: 1.8,
        }}
      >
        404
      </motion.h1>

      {/* Efek getar setelah jatuh */}
      <motion.div
        animate={{
          x: [0, -3, 3, -2, 2, -1, 1, 0],
        }}
        transition={{
          delay: 1.8,
          duration: 0.4,
          ease: "easeInOut",
        }}
      >
        <p className="mt-4 text-lg text-gray-700">
          Oops! Halaman yang Anda cari tidak ditemukan.
        </p>
      </motion.div>

      {/* Tombol kembali */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.2 }}
        className="mt-8"
      >
        <Button
          variant="default"
          size="lg"
          onClick={() => (window.location.href = "/")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-md transition-all duration-300 hover:scale-105"
        >
          Kembali ke Beranda
        </Button>
      </motion.div>

      {/* Partikel kecil jatuh di background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-200 rounded-full opacity-60"
            initial={{
              x: Math.random() * window.innerWidth,
              y: -20,
              scale: Math.random() * 1.5 + 0.5,
            }}
            animate={{
              y: [null, window.innerHeight + 50],
              opacity: [0.8, 0],
            }}
            transition={{
              duration: Math.random() * 5 + 4,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default NotFound;