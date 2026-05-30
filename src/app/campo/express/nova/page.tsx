"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCampoDb } from "@/features/campo/db";
import { obterCoordenadasPrecisas } from "@/app/solicitar/form";
import { buscarCepAction, geocodeReversoAction } from "@/app/solicitar/actions";
import { criarSolicitacaoExpressAction } from "../actions";
import { toast } from "sonner";

type Categoria = "ELETRICA" | "PINTURA" | "DRYWALL";

const CATEGORIAS: { value: Categoria; label: string; descricao: string }[] = [
  { value: "ELETRICA", label: "Elétrica", descricao: "Tomadas, quadro, fiação" },
  { value: "PINTURA", label: "Pintura", descricao: "Interna, externa, retoque" },
  { value: "DRYWALL", label: "Drywall", descricao: "Divisórias, forros" },
];

export default function NovaExpressPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();

  // Dados do formulário
  const [lgpd, setLgpd] = useState(false);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [categorias, setCategorias] = useState<Set<Categoria>>(new Set());
  
  // Endereço
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Estados de carregamento locais
  const [buscandoLocal, setBuscandoLocal] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  function toggleCategoria(c: Categoria) {
    const n = new Set(categorias);
    n.has(c) ? n.delete(c) : n.add(c);
    setCategorias(n);
  }

  async function pegarLocalizacao() {
    setErroForm(null);
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
        setErroForm("GPS obtido, mas geocodificação falhou. Preencha o endereço manualmente.");
      }
    } catch (err: any) {
      setErroForm(err.message || "Não foi possível obter a localização do GPS.");
    } finally {
      setBuscandoLocal(false);
    }
  }

  async function preencherViaCep() {
    setErroForm(null);
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) {
      setErroForm("CEP precisa ter 8 dígitos");
      return;
    }
    setBuscandoCep(true);
    try {
      const e = await buscarCepAction(limpo);
      setLogradouro(e.logradouro);
      setBairro(e.bairro);
      setCidade(e.cidade);
      setUf(e.uf);
    } catch (e: any) {
      setErroForm(e.message || "CEP inválido ou erro ao buscar");
    } finally {
      setBuscandoCep(false);
    }
  }

  async function submeter() {
    setErroForm(null);

    // Validações básicas antes de enviar
    if (!lgpd) return setErroForm("O aceite da LGPD pelo cliente é obrigatório");
    if (!nome.trim()) return setErroForm("Nome do cliente é obrigatório");
    if (!/^\d{10,11}$/.test(whatsapp)) return setErroForm("WhatsApp do cliente inválido (use 10 ou 11 dígitos numéricos)");
    if (categorias.size === 0) return setErroForm("Selecione pelo menos uma categoria de serviço");
    if (!logradouro.trim()) return setErroForm("O logradouro do endereço é obrigatório");
    if (!cidade.trim()) return setErroForm("A cidade do endereço é obrigatória");
    if (!uf.trim() || uf.length !== 2) return setErroForm("A UF é obrigatória (2 letras)");

    const endereco = {
      logradouro,
      numero: numero.trim() || undefined,
      complemento: complemento.trim() || undefined,
      bairro: bairro.trim() || undefined,
      cidade,
      uf: uf.toUpperCase(),
      cep: cep.trim() || undefined,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
    };

    // Fluxo Offline: Salva localmente se offline
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      startTransition(async () => {
        try {
          const db = getCampoDb();
          const r = Math.random().toString(36).slice(2, 10);
          
          await db.transaction("rw", db.os_local_cache, db.fila_sync, async () => {
            // Cria um ID temporário e cacheia a OS localmente
            const idTemp = `local-os-${r}`;
            
            // Adiciona uma entrada no cache para cada categoria selecionada
            for (const cat of categorias) {
              await db.os_local_cache.add({
                id: `${idTemp}-${cat}`,
                categoria: cat,
                estado: "ORCADA",
                clienteNome: nome,
                cidade: endereco.cidade,
                uf: endereco.uf,
                criadoEm: new Date().toISOString(),
                cacheEm: new Date().toISOString(),
              });
            }

            // Enfileira a ação de criação no fila_sync
            await db.fila_sync.add({
              tipo: "SOLICITACAO_EXPRESS",
              payload: {
                idTemp,
                nome,
                whatsapp,
                categorias: [...categorias],
                endereco,
              },
              criadoEm: new Date().toISOString(),
              tentativas: 0,
            });
          });

          toast.success("Gravado offline! A solicitação será sincronizada ao recuperar internet.");
          router.push("/campo");
        } catch (e: any) {
          setErroForm("Erro ao salvar offline: " + e.message);
        }
      });
      return;
    }

    // Fluxo Online
    startTransition(async () => {
      const formData = new FormData();
      formData.append("nome", nome);
      formData.append("whatsapp", whatsapp);
      formData.append("lgpdAceito", lgpd ? "true" : "false");
      formData.append("end_logradouro", logradouro);
      if (numero) formData.append("end_numero", numero);
      if (complemento) formData.append("end_complemento", complemento);
      if (bairro) formData.append("end_bairro", bairro);
      formData.append("end_cidade", cidade);
      formData.append("end_uf", uf);
      if (cep) formData.append("end_cep", cep);
      if (lat !== null) formData.append("end_lat", String(lat));
      if (lng !== null) formData.append("end_lng", String(lng));
      
      categorias.forEach((c) => {
        formData.append("categorias", c);
      });

      const res = await criarSolicitacaoExpressAction({}, formData);
      if (res.erro) {
        setErroForm(res.erro);
      }
    });
  }

  // Navegação do Wizard
  const proximo = () => {
    if (step === 1 && !lgpd) {
      setErroForm("O cliente precisa aceitar a LGPD verbalmente");
      return;
    }
    if (step === 2 && (!nome.trim() || !/^\d{10,11}$/.test(whatsapp))) {
      setErroForm("Nome e WhatsApp do cliente (10/11 dígitos numéricos) são obrigatórios");
      return;
    }
    if (step === 3 && categorias.size === 0) {
      setErroForm("Selecione pelo menos uma categoria");
      return;
    }
    setErroForm(null);
    setStep(step + 1);
  };

  const anterior = () => {
    setErroForm(null);
    setStep(step - 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b pb-3">
        <Link href={"/campo" as Route} className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Solicitação Express</h1>
          <p className="text-xs text-muted-foreground">Passo {step} de 4</p>
        </div>
      </div>

      {erroForm && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {erroForm}
        </div>
      )}

      {/* Passo 1: LGPD */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h2 className="font-semibold text-sm">Privacidade e Consentimento LGPD</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Para registrar a solicitação, precisamos coletar dados básicos do cliente 
              (nome, telefone, endereço). O cliente deve consentir verbalmente com o 
              compartilhamento dos dados para análise do serviço.
            </p>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted p-3">
            <Checkbox
              id="lgpd"
              checked={lgpd}
              onCheckedChange={(v) => setLgpd(v === true)}
            />
            <Label htmlFor="lgpd" className="text-xs leading-relaxed font-medium select-none cursor-pointer">
              Confirmo que o cliente aceitou os termos LGPD verbalmente e autorizou a inserção de seus dados.
            </Label>
          </div>
        </div>
      )}

      {/* Passo 2: WhatsApp e Nome do Cliente */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do cliente</Label>
            <Input
              id="nome"
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João da Silva"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp do cliente</Label>
            <Input
              id="whatsapp"
              type="tel"
              required
              inputMode="numeric"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex: 11999998888 (apenas números)"
            />
          </div>
        </div>
      )}

      {/* Passo 3: Categoria de Serviço */}
      {step === 3 && (
        <div className="space-y-4">
          <Label className="text-sm font-semibold">O que o cliente precisa?</Label>
          <div className="flex flex-col gap-2">
            {CATEGORIAS.map((c) => {
              const sel = categorias.has(c.value);
              return (
                <Button
                  key={c.value}
                  type="button"
                  variant="outline"
                  onClick={() => toggleCategoria(c.value)}
                  className={`h-auto flex flex-col items-start rounded-lg border-2 p-4 text-left font-normal transition-colors select-none ${
                    sel
                      ? "border-primary bg-primary/5 hover:bg-primary/5 hover:text-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="font-semibold text-sm">{c.label}</span>
                  <span className="text-[11px] text-muted-foreground mt-1 font-normal">
                    {c.descricao}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Passo 4: Endereço (GPS ou Manual) */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={buscandoLocal}
              onClick={pegarLocalizacao}
            >
              <MapPin className="mr-1 size-4" />
              {buscandoLocal ? "Buscando GPS…" : "Usar minha localização"}
            </Button>
            {lat !== null && (
              <span className="text-xs text-muted-foreground self-center">
                Coordenadas: {lat.toFixed(4)}, {lng?.toFixed(4)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label htmlFor="end_cep" className="text-xs">CEP</Label>
              <Input
                id="end_cep"
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
                className="w-full h-10"
                disabled={buscandoCep}
                onClick={preencherViaCep}
              >
                {buscandoCep ? "Carregando…" : "Buscar"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="end_logradouro" className="text-xs">Logradouro (Rua/Av.)</Label>
            <Input
              id="end_logradouro"
              required
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
              placeholder="Ex: Rua das Flores"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="end_numero" className="text-xs">Número</Label>
              <Input
                id="end_numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex: 123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_complemento" className="text-xs">Complemento</Label>
              <Input
                id="end_complemento"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                placeholder="Ex: Apto 4"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="end_bairro" className="text-xs">Bairro</Label>
            <Input
              id="end_bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              placeholder="Ex: Centro"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="end_cidade" className="text-xs">Cidade</Label>
              <Input
                id="end_cidade"
                required
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex: São Paulo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_uf" className="text-xs">UF</Label>
              <Input
                id="end_uf"
                required
                maxLength={2}
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                placeholder="SP"
              />
            </div>
          </div>
        </div>
      )}

      {/* Botões de Ação do Wizard */}
      <div className="flex gap-3 pt-4 border-t">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={anterior}
            disabled={pending}
            className="flex-1"
          >
            Anterior
          </Button>
        )}
        {step < 4 ? (
          <Button
            type="button"
            onClick={proximo}
            className="flex-1"
          >
            Próximo
            <ArrowRight className="ml-1 size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={submeter}
            disabled={pending}
            className="flex-1"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <Check className="size-4 mr-1" />
            )}
            Criar OS Express
          </Button>
        )}
      </div>
    </div>
  );
}
