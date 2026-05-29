"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Camera, MapPin, Mic, Square, X } from "lucide-react";
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

type Categoria = "ELETRICA" | "PINTURA" | "DRYWALL";

const CATEGORIAS: { value: Categoria; label: string; descricao: string }[] = [
  { value: "ELETRICA", label: "Elétrica", descricao: "Tomadas, quadro, fiação" },
  { value: "PINTURA", label: "Pintura", descricao: "Interna, externa, retoque" },
  { value: "DRYWALL", label: "Drywall", descricao: "Divisórias, forros" },
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
function obterCoordenadasPrecisas(
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

export function SolicitarForm() {
  const [state, action, pending] = useActionState<SolicitarState, FormData>(
    criarSolicitacaoAction,
    {},
  );
  const [categorias, setCategorias] = useState<Set<Categoria>>(new Set());
  const [fotos, setFotos] = useState<string[]>([]);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
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
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [buscandoLocal, setBuscandoLocal] = useState(false);
  const [gravando, setGravando] = useState(false);

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
    setEnviandoFoto(true);
    try {
      const novas: string[] = [];
      for (const file of arr) {
        const { uploadUrl, key } = await assinarUploadFotoSolicitacaoAction({
          filename: file.name,
          contentType: file.type,
        });
        const res = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload falhou (${res.status})`);
        novas.push(key);
      }
      setFotos([...fotos, ...novas]);
    } catch (e) {
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
    setErroLocal(null); // Limpa erros antigos ao iniciar a gravação
    const Ctor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;

    // Guarda o texto inicial da descrição antes de começar a falar
    textoBaseRef.current = descricao;

    rec.onresult = (e) => {
      // Loop padrão compatível com todos os navegadores (incluindo Safari móvel)
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

  return (
    <form action={action} className="space-y-6">
      {/* WhatsApp + Nome */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" required placeholder="Como te chamamos?" />
        </div>
        <div>
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            required
            inputMode="numeric"
            placeholder="(11) 91234-5678"
          />
        </div>
      </div>

      {/* Categorias */}
      <div>
        <Label className="mb-2 block">O que você precisa?</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CATEGORIAS.map((c) => {
            const sel = categorias.has(c.value);
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => toggleCategoria(c.value)}
                className={`rounded-lg border-2 p-4 text-left transition-colors ${
                  sel
                    ? "border-foreground bg-foreground/5"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="font-medium">{c.label}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {c.descricao}
                </div>
              </button>
            );
          })}
        </div>
        {[...categorias].map((c) => (
          <input key={c} type="hidden" name="categorias" value={c} />
        ))}
      </div>

      {/* Endereço */}
      <div className="space-y-3">
        <Label>Endereço</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={buscandoLocal}
            onClick={pegarLocalizacao}
          >
            <MapPin className="mr-1 size-4" />
            {buscandoLocal ? "Buscando…" : "Usar localização"}
          </Button>
          {lat !== null && (
            <span className="text-xs text-muted-foreground self-center">
              GPS capturado ({lat.toFixed(4)}, {lng?.toFixed(4)})
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Label htmlFor="end_cep" className="text-xs">
              CEP
            </Label>
            <Input
              id="end_cep"
              name="end_cep"
              value={cep}
              onChange={(e) => setCep(e.target.value)}
              placeholder="01000-000"
              inputMode="numeric"
            />
          </div>
          <div className="self-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={preencherViaCep}
            >
              Buscar
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor="end_logradouro" className="text-xs">
            Logradouro
          </Label>
          <Input
            id="end_logradouro"
            name="end_logradouro"
            value={logradouro}
            onChange={(e) => setLogradouro(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="end_numero" className="text-xs">
              Número
            </Label>
            <Input
              id="end_numero"
              name="end_numero"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="end_complemento" className="text-xs">
              Compl.
            </Label>
            <Input
              id="end_complemento"
              name="end_complemento"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="end_bairro" className="text-xs">
            Bairro
          </Label>
          <Input
            id="end_bairro"
            name="end_bairro"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Label htmlFor="end_cidade" className="text-xs">
              Cidade
            </Label>
            <Input
              id="end_cidade"
              name="end_cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="end_uf" className="text-xs">
              UF
            </Label>
            <Input
              id="end_uf"
              name="end_uf"
              value={uf}
              onChange={(e) => setUf(e.target.value.toUpperCase())}
              maxLength={2}
              required
            />
          </div>
        </div>
        <input type="hidden" name="end_lat" value={lat ?? ""} />
        <input type="hidden" name="end_lng" value={lng ?? ""} />
      </div>

      {/* Data + Duração */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="dataDesejada">Data desejada</Label>
          <Input id="dataDesejada" name="dataDesejada" type="date" />
        </div>
        <div>
          <Label>Duração estimada</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {DURACOES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDuracao(duracao === d.value ? "" : d.value)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  duracao === d.value
                    ? "bg-foreground text-background"
                    : "border-border hover:bg-muted"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="duracaoEstimada" value={duracao} />
        </div>
      </div>

      {/* Descrição */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="descricao">Descreva o serviço</Label>
          {speechSuportado && (
            <Button
              type="button"
              size="sm"
              variant={gravando ? "destructive" : "outline"}
              onClick={alternarGravacao}
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
              ? "Escreva ou clique em Falar para ditar"
              : "Descreva o que precisa"
          }
        />
      </div>

      {/* Fotos */}
      <div>
        <Label>Fotos (opcional, até 5)</Label>
        <div className="mt-2">
          <label
            className={`flex items-center gap-2 rounded border border-dashed p-3 text-sm cursor-pointer ${fotos.length >= 5 ? "opacity-50 cursor-not-allowed" : "hover:bg-muted"}`}
          >
            <Camera className="size-4" />
            <span>
              {fotos.length === 0
                ? "Adicionar fotos"
                : `${fotos.length} / 5 enviada${fotos.length === 1 ? "" : "s"}`}
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
          {enviandoFoto && (
            <p className="text-xs text-muted-foreground mt-1">Enviando…</p>
          )}
          {fotos.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {fotos.map((k) => (
                <li
                  key={k}
                  className="flex items-center gap-1 rounded border px-2 py-1 text-xs"
                >
                  <span className="truncate max-w-[8rem]">{k.split("/").pop()}</span>
                  <button
                    type="button"
                    aria-label="Remover foto"
                    onClick={() => setFotos(fotos.filter((x) => x !== k))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fotos.map((k) => (
            <input key={k} type="hidden" name="fotosKeys" value={k} />
          ))}
        </div>
      </div>

      {/* LGPD */}
      <div className="flex items-start gap-2 rounded-lg border bg-muted p-3">
        <Checkbox
          id="lgpd"
          checked={lgpd}
          onCheckedChange={(v) => setLgpd(v === true)}
        />
        <label htmlFor="lgpd" className="text-xs leading-relaxed">
          Concordo em compartilhar meus dados (nome, WhatsApp, endereço, fotos)
          com a DBG para análise da solicitação, conforme a LGPD. Posso pedir a
          remoção a qualquer momento.
        </label>
        <input type="hidden" name="lgpdAceito" value={lgpd ? "true" : "false"} />
      </div>

      {(state.erro || erroLocal) && (
        <p className="text-sm text-destructive" role="alert">
          {state.erro ?? erroLocal}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={
          pending || enviandoFoto || categorias.size === 0 || !lgpd
        }
      >
        {pending ? "Enviando…" : "Enviar solicitação"}
      </Button>
    </form>
  );
}
