import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, IdCard, Image, GraduationCap, Stethoscope } from "lucide-react";
import { Navbar } from "@/components/Navbar";

const documents = [
  {
    title: "Ijazah",
    description: "Dokumen resmi bukti kelulusan pendidikan.",
    icon: <GraduationCap className="h-10 w-10 text-blue-500" />,
  },
  {
    title: "KTP",
    description: "Kartu Tanda Penduduk untuk identitas resmi.",
    icon: <IdCard className="h-10 w-10 text-green-500" />,
  },
  {
    title: "Pas Foto",
    description: "Foto resmi untuk dokumen dan identitas.",
    icon: <Image className="h-10 w-10 text-purple-500" />,
  },
  {
    title: "Transkrip Nilai",
    description: "Catatan nilai akademik selama pendidikan.",
    icon: <FileText className="h-10 w-10 text-orange-500" />,
  },
  {
    title: "Surat Keterangan Dokter",
    description: "Dokumen kesehatan resmi dari dokter.",
    icon: <Stethoscope className="h-10 w-10 text-red-500" />,
  },
];

const DocumentCardsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="min-h-screen bg-gray-50 p-8">
        <h1 className="text-3xl font-bold text-center mb-10">Daftar Dokumen</h1>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {documents.map((doc) => (
            <Card key={doc.title} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-col items-center justify-center space-y-3">
                {doc.icon}
                <CardTitle className="text-lg font-semibold">{doc.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-gray-600">
                {doc.description}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DocumentCardsPage;
