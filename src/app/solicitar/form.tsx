"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Script from "next/script";
import { Camera, MapPin, Mic, Square, X, Zap, Paintbrush, Layers, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  assinarUploadFotoSolicitacaoAction,
  buscarCepAction,
  criarSolicitacaoAction,
  geocodeReversoAction,
  type SolicitarState,
} from "./actions";
import { bairroForaDaCobertura } from "@/operacao/cobertura";

type Categoria = "ELETRICA" | "PINTURA" | "DRYWALL" | "OUTRO";

const CATEGORIAS = [
  { value: "ELETRICA" as const, label: "Elétrica", descricao: "Tomadas, quadro, fiação", icon: Zap },
  { value: "PINTURA" as const, label: "Pintura", descricao: "Interna, externa, retoque", icon: Paintbrush },
  { value: "DRYWALL" as const, label: "Drywall", descricao: "Divisórias, forros", icon: Layers },
  { value: "OUTRO" as const, label: "Outro", descricao: "Outros serviços", icon: HelpCircle },
];

const DURACOES = [
  { value: "1h", label: "Até 1 hora" },
  { value: "2-4h", label: "Meia diária" },
  { value: "dia", label: "Dia inteiro" },
  { value: "obra", label: "Mais de um dia" },
];

interface SpeechRec extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: { transcript: string }[][] }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: { new (): SpeechRec };
    SpeechRecognition?: { new (): SpeechRec };
  }
}

/**
 * Obtém as coordenadas geográficas do usuário com alta precisão.
 * Utiliza watchPosition para rastrear a melhor precisão disponível por até 12 segundos,
 * interrompendo a busca assim que uma precisão de <= 20 metros é atingida.
 */
export function obterCoordenadasPrecisas(
  onUpdate?: (pos: GeolocationPosition) => void
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return reject(new Error("Geolocalização não disponível no navegador"));
    }

    let watchId: number | null = null;
    let melhorPosicao: GeolocationPosition | null = null;

    const timeoutId = setTimeout(() => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        if (melhorPosicao) {
          resolve(melhorPosicao);
        } else {
          reject(new Error("Não foi possível obter uma localização precisa a tempo."));
        }
      }
    }, 12000); // 12 segundos esperando o sinal ideal

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!melhorPosicao || pos.coords.accuracy < melhorPosicao.coords.accuracy) {
          melhorPosicao = pos;
          if (onUpdate) onUpdate(pos);
        }

        if (pos.coords.accuracy <= 20) {
          clearTimeout(timeoutId);
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          resolve(pos);
        }
      },
      (err) => {
        if (!melhorPosicao) {
          clearTimeout(timeoutId);
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          reject(err);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

export interface SolicitarFormProps {
  /** Server action a executar no submit. Default: fluxo público. */
  onSubmitAction?: (
    state: SolicitarState,
    form: FormData,
  ) => Promise<SolicitarState>;
  /** Texto do consentimento LGPD. Default: termo do cliente final. */
  consentLabel?: React.ReactNode;
  /** Rótulo do botão de envio. */
  submitLabel?: string;
  /** Lista de bairros atendidos. */
  bairrosAtendidos?: string[];
  /** Categorias pré-selecionadas (ex.: landing de um serviço). */
  categoriasIniciais?: Categoria[];
}

function formatarWhatsApp(valor: string) {
  const apenasNumeros = valor.replace(/\D/g, "");
  if (apenasNumeros.length === 0) return "";
  if (apenasNumeros.length <= 2) {
    return `(${apenasNumeros}`;
  }
  if (apenasNumeros.length <= 6) {
    return `(${apenasNumeros.substring(0, 2)}) ${apenasNumeros.substring(2)}`;
  }
  if (apenasNumeros.length <= 10) {
    return `(${apenasNumeros.substring(0, 2)}) ${apenasNumeros.substring(2, 6)}-${apenasNumeros.substring(6)}`;
  }
  return `(${apenasNumeros.substring(0, 2)}) ${apenasNumeros.substring(2, 7)}-${apenasNumeros.substring(7, 11)}`;
}

function formatarCEP(valor: string) {
  const apenasNumeros = valor.replace(/\D/g, "");
  if (apenasNumeros.length === 0) return "";
  if (apenasNumeros.length <= 5) {
    return apenasNumeros;
  }
  return `${apenasNumeros.substring(0, 5)}-${apenasNumeros.substring(5, 8)}`;
}

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const CONSENT_LABEL_PUBLICO =
  "Concordo em compartilhar meus dados (nome, WhatsApp, endereço, fotos) com a DBG para análise da solicitação, conforme a LGPD. Posso pedir a remoção a qualquer momento.";

export function SolicitarForm({
  onSubmitAction = criarSolicitacaoAction,
  consentLabel = CONSENT_LABEL_PUBLICO,
  submitLabel = "Enviar solicitação",
  bairrosAtendidos = [],
  categoriasIniciais = [],
}: SolicitarFormProps = {}) {
  const [state, action, pending] = useActionState<SolicitarState, FormData>(
    onSubmitAction,
    {},
  );
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [categorias, setCategorias] = useState<Set<Categoria>>(
    () => new Set(categoriasIniciais),
  );
  const [fotos, setFotos] = useState<string[]>([]);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [indicadorId, setIndicadorId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        setTimeout(() => {
          setIndicadorId(ref);
        }, 0);
      }
    }
  }, []);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const previewsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    return () => {
      Object.values(previewsRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  const removerFoto = (key: string) => {
    setPreviews((prev) => {
      const url = prev[key];
      if (url) {
        URL.revokeObjectURL(url);
      }
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setFotos((prev) => prev.filter((x) => x !== key));
  };

  const [descricao, setDescricao] = useState("");
  const [duracao, setDuracao] = useState<string>("");
  const [lgpd, setLgpd] = useState(false);
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [dataDesejada, setDataDesejada] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [buscandoLocal, setBuscandoLocal] = useState(false);
  const [gravando, setGravando] = useState(false);

  const foraCobertura = bairroForaDaCobertura(bairro, bairrosAtendidos);

  const speechSuportado = useSyncExternalStore(
    () => () => {},
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    () => false,
  );
  const recRef = useRef<SpeechRec | null>(null);
  const textoBaseRef = useRef("");

  function toggleCategoria(c: Categoria) {
    const n = new Set(categorias);
    n.has(c) ? n.delete(c) : n.add(c);
    setCategorias(n);
  }

  async function pegarLocalizacao() {
    setErroLocal(null);
    setBuscandoLocal(true);

    try {
      const pos = await obterCoordenadasPrecisas((p) => {
        setLat(p.coords.latitude);
        setLng(p.coords.longitude);
      });

      const { latitude, longitude } = pos.coords;
      setLat(latitude);
      setLng(longitude);

      try {
        const e = await geocodeReversoAction(latitude, longitude);
        if (e.cep) setCep(e.cep);
        if (e.logradouro) setLogradouro(e.logradouro);
        if (e.bairro) setBairro(e.bairro);
        if (e.cidade) setCidade(e.cidade);
        if (e.uf) setUf(e.uf);
      } catch {
        setErroLocal(
          "Localização capturada, mas não consegui preencher o endereço. Complete manualmente.",
        );
      }
    } catch (err: any) {
      if (err.message === "Geolocalização não disponível no navegador") {
        setErroLocal(err.message);
      } else if (err.message === "Não foi possível obter uma localização precisa a tempo.") {
        setErroLocal(err.message);
      } else {
        setErroLocal("Não foi possível obter sua localização");
      }
    } finally {
      setBuscandoLocal(false);
    }
  }


  async function preencherViaCep() {
    setErroLocal(null);
    if (cep.replace(/\D/g, "").length !== 8) {
      setErroLocal("CEP precisa de 8 dígitos");
      return;
    }
    try {
      const e = await buscarCepAction(cep);
      setLogradouro(e.logradouro);
      setBairro(e.bairro);
      setCidade(e.cidade);
      setUf(e.uf);
    } catch (e) {
      setErroLocal(e instanceof Error ? e.message : "CEP inválido");
    }
  }

  async function enviarFotos(files: FileList | null) {
    if (!files) return;
    setErroLocal(null);
    const restantes = Math.max(0, 5 - fotos.length);
    const arr = Array.from(files).slice(0, restantes);
    if (arr.length === 0) return;
    const grande = arr.find((f) => f.size > 10 * 1024 * 1024);
    if (grande) {
      setErroLocal(`"${grande.name}" passa de 10MB — reduza a foto e tente de novo`);
      return;
    }
    setEnviandoFoto(true);
    try {
      await Promise.all(
        arr.map(async (file) => {
          const { uploadUrl, key } = await assinarUploadFotoSolicitacaoAction({
            filename: file.name,
            contentType: file.type,
            contentLength: file.size,
          });
          const res = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!res.ok) throw new Error(`Upload falhou (${res.status})`);

          const objectUrl = URL.createObjectURL(file);
          setPreviews((prev) => ({ ...prev, [key]: objectUrl }));

          setFotos((prev) => {
            if (prev.includes(key)) return prev;
            if (prev.length >= 5) return prev;
            return [...prev, key];
          });
        })
      );
    } catch (e) {
      console.error("Erro no upload de fotos:", e);
      setErroLocal(e instanceof Error ? e.message : "falha no upload");
    } finally {
      setEnviandoFoto(false);
    }
  }

  function alternarGravacao() {
    if (!speechSuportado) return;
    if (gravando) {
      recRef.current?.stop();
      return;
    }
    setErroLocal(null);
    const Ctor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;

    textoBaseRef.current = descricao;

    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      
      const textoFinal = textoBaseRef.current
        ? `${textoBaseRef.current} ${transcript.trim()}`
        : transcript.trim();

      setDescricao(textoFinal);
    };

    rec.onend = () => {
      setGravando(false);
    };

    rec.onerror = (event: any) => {
      console.error("Erro SpeechRecognition:", event.error);
      if (event.error === "not-allowed") {
        setErroLocal("Permissão para usar o microfone foi negada pelo navegador.");
      } else if (event.error === "no-speech") {
        setErroLocal("Nenhuma fala detectada. Tente falar mais perto do microfone.");
      } else if (event.error === "network") {
        setErroLocal("Erro de conexão. O reconhecimento de voz precisa de internet.");
      } else {
        setErroLocal(`Falha ao capturar áudio: ${event.error}`);
      }
      setGravando(false);
    };

    rec.start();
    recRef.current = rec;
    setGravando(true);
  }

  const step1Valido =
    nome.trim() !== "" &&
    whatsapp.replace(/\D/g, "").length >= 10 &&
    categorias.size > 0;

  const step2Valido =
    logradouro.trim() !== "" &&
    cidade.trim() !== "" &&
    uf.trim().length === 2;

  return (
    <form action={action} className="space-y-6">
      {indicadorId && (
        <input type="hidden" name="indicadorId" value={indicadorId} />
      )}

      <div className="space-y-3 pb-2 border-b border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-brand-ink">Passo {step} de 3</span>
          <span className="font-medium text-muted-foreground">
            {step === 1 ? "Identificação & Serviço" : step === 2 ? "Endereço & Data" : "Detalhes & Envio"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 3 ? "bg-primary" : "bg-muted"}`} />
        </div>
      </div>

      <div className={`space-y-6 animate-in fade-in duration-300 ${step === 1 ? "" : "hidden"}`}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input 
              id="nome" 
              name="nome" 
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Como te chamamos?" 
              className="h-10"
            />
          </div>
          <div>
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="numeric"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatarWhatsApp(e.target.value))}
              placeholder="(11) 91234-5678"
              className="h-10"
            />
          </div>
        </div>

        <div>
          <Label className="mb-3 block font-medium">O que você precisa?</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CATEGORIAS.map((c) => {
              const sel = categorias.has(c.value);
              const Icone = c.icon;
              return (
                <Button
                  key={c.value}
                  type="button"
                  variant="outline"
                  onClick={() => toggleCategoria(c.value)}
                  className={`h-auto flex items-center justify-start gap-3.5 rounded-xl border-2 p-3 text-left font-normal transition-all duration-200 select-none ${
                    sel
                      ? "border-primary bg-primary/5 hover:bg-primary/5 hover:text-foreground text-foreground ring-1 ring-primary/30"
                      : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    sel ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <Icone className="size-5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`font-semibold text-sm transition-colors ${sel ? "text-foreground" : "text-card-foreground"}`}>
                      {c.label}
                    </span>
                    <span className="text-[11px] leading-tight text-muted-foreground mt-0.5 truncate font-normal">
                      {c.descricao}
                    </span>
                  </div>
                </Button>
              );
            })}
          </div>
          {[...categorias].map((c) => (
            <input key={c} type="hidden" name="categorias" value={c} />
          ))}
        </div>
        
        <div className="pt-2">
          <Button
            type="button"
            className="w-full h-10"
            disabled={!step1Valido}
            onClick={() => setStep(2)}
          >
            Avançar
          </Button>
        </div>
      </div>

      <div className={`space-y-6 animate-in fade-in duration-300 ${step === 2 ? "" : "hidden"}`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-medium">Onde será o serviço?</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={buscandoLocal}
              onClick={pegarLocalizacao}
              className="h-8"
            >
              <MapPin className="mr-1 size-4" />
              {buscandoLocal ? "Buscando…" : "Usar localização"}
            </Button>
          </div>
          
          {lat !== null && (
            <div className="text-xs text-muted-foreground bg-primary/5 p-2 rounded-lg border border-primary/10">
              GPS capturado ({lat.toFixed(4)}, {lng?.toFixed(4)})
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label htmlFor="end_cep" className="text-xs">CEP</Label>
              <Input
                id="end_cep"
                name="end_cep"
                value={cep}
                onChange={(e) => setCep(formatarCEP(e.target.value))}
                placeholder="01000-000"
                inputMode="numeric"
                className="h-10"
              />
            </div>
            <div className="self-end">
              <Button
                type="button"
                variant="outline"
                className="w-full h-10"
                onClick={preencherViaCep}
              >
                Buscar
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="end_logradouro" className="text-xs">Logradouro</Label>
            <Input
              id="end_logradouro"
              name="end_logradouro"
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="end_numero" className="text-xs">Número</Label>
              <Input
                id="end_numero"
                name="end_numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="end_complemento" className="text-xs">Complemento</Label>
              <Input
                id="end_complemento"
                name="end_complemento"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="end_bairro" className="text-xs">Bairro</Label>
            <Input
              id="end_bairro"
              name="end_bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className="h-10"
            />
            {foraCobertura && (
              <div id="aviso-fora-cobertura" className="mt-2 rounded-lg border border-warning bg-warning/10 p-3 text-xs text-warning-foreground dark:text-warning flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <span className="font-medium">⚠️ Atenção:</span>
                <span>
                  Este bairro parece estar fora da nossa área de atendimento padrão. 
                  Você ainda pode enviar a solicitação, mas o atendimento poderá demorar mais ou ter taxas adicionais.
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label htmlFor="end_cidade" className="text-xs">Cidade</Label>
              <Input
                id="end_cidade"
                name="end_cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="h-10"
              />
            </div>
            <div>
              <Label htmlFor="end_uf" className="text-xs">UF</Label>
              <Input
                id="end_uf"
                name="end_uf"
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                maxLength={2}
                className="h-10"
              />
            </div>
          </div>
          <input type="hidden" name="end_lat" value={lat ?? ""} />
          <input type="hidden" name="end_lng" value={lng ?? ""} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-4 border-t border-border">
          <div>
            <Label htmlFor="dataDesejada">Data desejada</Label>
            <Input 
              id="dataDesejada" 
              name="dataDesejada" 
              type="date" 
              value={dataDesejada}
              onChange={(e) => setDataDesejada(e.target.value)}
              className="h-10"
            />
          </div>
          <div>
            <Label>Duração estimada</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURACOES.map((d) => {
                const sel = duracao === d.value;
                return (
                  <Button
                    key={d.value}
                    type="button"
                    variant={sel ? "default" : "outline"}
                    onClick={() => setDuracao(sel ? "" : d.value)}
                    className="h-11 sm:h-7 rounded-full px-3.5 text-xs select-none"
                  >
                    {d.label}
                  </Button>
                );
              })}
            </div>
            <input type="hidden" name="duracaoEstimada" value={duracao} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="w-full h-10"
            onClick={() => setStep(1)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            className="w-full h-10"
            disabled={!step2Valido}
            onClick={() => setStep(3)}
          >
            Avançar
          </Button>
        </div>
      </div>

      <div className={`space-y-6 animate-in fade-in duration-300 ${step === 3 ? "" : "hidden"}`}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="descricao" className="font-medium">Descreva o serviço</Label>
            {speechSuportado && (
              <Button
                type="button"
                size="sm"
                variant={gravando ? "destructive" : "outline"}
                onClick={alternarGravacao}
                className="h-7"
              >
                {gravando ? (
                  <>
                    <Square className="mr-1 size-3" />
                    Parar
                  </>
                ) : (
                  <>
                    <Mic className="mr-1 size-3" />
                    Falar
                  </>
                )}
              </Button>
            )}
          </div>
          <Textarea
            id="descricao"
            name="descricao"
            rows={4}
            value={descricao}
            onChange={(e) => {
              setDescricao(e.target.value);
              textoBaseRef.current = e.target.value;
            }}
            placeholder={
              speechSuportado
                ? "Escreva ou clique em Falar para ditar..."
                : "Descreva o que precisa..."
            }
          />
        </div>

        <div>
          <Label className="font-medium">Fotos (opcional, até 5)</Label>
          <div className="mt-2">
            <label
              className={`flex items-center gap-2 rounded border border-dashed p-3 text-sm transition-all duration-200 ${
                fotos.length >= 5
                  ? "opacity-50 cursor-not-allowed bg-muted/30 border-muted text-muted-foreground"
                  : "cursor-pointer hover:bg-muted hover:border-muted-foreground/30 border-border"
              }`}
            >
              <Camera className="size-4" />
              <span>
                {fotos.length === 0
                  ? "Adicionar fotos"
                  : fotos.length >= 5
                    ? "Limite máximo de 5 fotos atingido"
                    : `${fotos.length} / 5 fotos enviadas`}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                hidden
                disabled={fotos.length >= 5 || enviandoFoto}
                onChange={(e) => enviarFotos(e.target.files)}
              />
            </label>
            {(fotos.length > 0 || enviandoFoto) && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {fotos.map((k) => {
                  const previewUrl = previews[k];
                  return (
                    <div
                      key={k}
                      className="group relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt="Miniatura"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Camera className="size-6 animate-pulse" />
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        onClick={() => removerFoto(k)}
                        className="absolute top-1.5 right-1.5 z-10 size-6 rounded-full border-border bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground hover:scale-105"
                        title="Remover foto"
                        aria-label="Remover foto"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  );
                })}
                {enviandoFoto && (
                  <div className="aspect-square w-full rounded-xl border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center text-muted-foreground animate-pulse">
                    <div className="flex size-8 items-center justify-center rounded-full bg-background border border-border shadow-sm">
                      <svg className="size-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                    <span className="text-[10px] mt-2 font-medium">Enviando…</span>
                  </div>
                )}
              </div>
            )}
            {fotos.map((k) => (
              <input key={k} type="hidden" name="fotosKeys" value={k} />
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border bg-muted p-4">
          <Checkbox
            id="lgpd"
            checked={lgpd}
            onCheckedChange={(v) => setLgpd(v === true)}
            className="mt-0.5"
          />
          <label htmlFor="lgpd" className="text-xs leading-relaxed text-muted-foreground select-none cursor-pointer">
            {consentLabel}
          </label>
          <input type="hidden" name="lgpdAceito" value={lgpd ? "true" : "false"} />
        </div>

        {turnstileSiteKey && (
          <>
            <Script
              src="https://challenges.cloudflare.com/turnstile/v0/api.js"
              strategy="lazyOnload"
            />
            <div
              className="cf-turnstile flex justify-center py-2"
              data-sitekey={turnstileSiteKey}
              data-theme="auto"
            />
          </>
        )}

        {(state.erro || erroLocal) && (
          <p className="text-sm text-destructive font-medium bg-destructive/5 p-3 rounded-lg border border-destructive/10" role="alert">
            {state.erro ?? erroLocal}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="w-full h-10"
            disabled={pending}
            onClick={() => setStep(2)}
          >
            Voltar
          </Button>
          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full h-10 shadow-sm"
            disabled={pending || enviandoFoto || !lgpd}
          >
            {pending ? "Enviando…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
