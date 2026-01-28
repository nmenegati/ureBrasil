import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, RotateCcw, Check, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user",
  };

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      setError(null);
    } else {
      setError("Não foi possível capturar a imagem. Tente novamente.");
    }
  }, []);

  const handleRetake = () => {
    setCapturedImage(null);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!capturedImage) return;

    setIsLoading(true);
    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();

      const file = new File([blob], `selfie-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      onCapture(file);
    } catch (err) {
      setError("Erro ao processar imagem. Tente novamente.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserMediaError = (cameraError: string | DOMException) => {
    console.error("Camera error:", cameraError);
    setError(
      "Não foi possível acessar a câmera. Verifique as permissões do navegador."
    );
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Capturar Selfie
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
            {!capturedImage ? (
              <>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  onUserMediaError={handleUserMediaError}
                  className="w-full h-full object-cover"
                  mirrored
                />

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-80 border-4 border-white border-dashed rounded-full opacity-50" />
                </div>

                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <p className="text-white text-sm bg-black/50 inline-block px-4 py-2 rounded-full">
                    💡 Posicione seu rosto dentro do círculo
                  </p>
                </div>
              </>
            ) : (
              <img
                src={capturedImage}
                alt="Selfie capturada"
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <div className="flex gap-2 justify-end">
            {!capturedImage ? (
              <>
                <Button
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleCapture} disabled={isLoading}>
                  <Camera className="w-4 h-4 mr-2" />
                  Capturar Foto
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleRetake}
                  disabled={isLoading}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Tirar Outra
                </Button>
                <Button onClick={handleConfirm} disabled={isLoading}>
                  <Check className="w-4 h-4 mr-2" />
                  {isLoading ? "Processando..." : "Usar Esta Foto"}
                </Button>
              </>
            )}
          </div>

          {!capturedImage && (
            <p className="text-xs text-gray-500 text-center">
              Dica: Remova óculos e certifique-se de que seu rosto está bem iluminado
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

