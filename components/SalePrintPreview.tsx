import React from 'react';
import { Sale, Client, User } from '../types';
import { t } from '../translations';
import { ICONS } from '../constants';

interface SalePrintPreviewProps {
    sale: Sale;
    client?: Client;
    user: User;
    type: 'THERMAL' | 'DOT_MATRIX' | 'LASER';
    onClose: () => void;
}

const SalePrintPreview: React.FC<SalePrintPreviewProps> = ({ sale, client, user, type, onClose }) => {
    const handlePrint = () => {
        window.print();
    };

    const renderThermal = () => (
        <div className="w-[80mm] mx-auto bg-white text-black p-4 font-mono text-[10px] leading-tight">
            <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                <h2 className="font-bold text-sm uppercase">{user.name}</h2>
                <p>Venda #{sale.id.slice(-6).toUpperCase()}</p>
                <p>{sale.createdAt?.toDate().toLocaleString('pt-BR')}</p>
            </div>

            <div className="mb-2">
                <p className="font-bold uppercase">Cliente:</p>
                <p>{client?.name || 'Consumidor Final'}</p>
            </div>

            <div className="border-b border-dashed border-black pb-2 mb-2">
                <div className="flex justify-between font-bold border-b border-black mb-1">
                    <span>Item</span>
                    <span>Qtd x Vlr</span>
                    <span>Total</span>
                </div>
                {sale.items.map((it, i) => (
                    <div key={i} className="flex justify-between mb-1">
                        <span className="flex-1 truncate pr-2">{it.name}</span>
                        <span className="whitespace-nowrap">{it.quantity} x {it.price.toFixed(2)}</span>
                        <span className="font-bold">{(it.quantity * it.price).toFixed(2)}</span>
                    </div>
                ))}
            </div>

            <div className="space-y-1">
                <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>R$ {sale.subtotal.toFixed(2)}</span>
                </div>
                {sale.totalDiscount > 0 && (
                    <div className="flex justify-between text-rose-600">
                        <span>Desconto:</span>
                        <span>- R$ {sale.totalDiscount.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between font-bold text-sm border-t border-black pt-1">
                    <span>TOTAL:</span>
                    <span>R$ {sale.total.toFixed(2)}</span>
                </div>
            </div>

            <div className="mt-4 pt-2 border-t border-dashed border-black text-center text-[8px]">
                <p>OBRIGADO PELA PREFERÊNCIA!</p>
                <p>Documento Não Fiscal</p>
            </div>
        </div>
    );

    const renderDotMatrix = () => (
        <div className="w-[210mm] mx-auto bg-white text-black p-10 font-mono text-xs border border-zinc-200">
            <div className="border-2 border-black p-4 mb-4 flex justify-between">
                <div>
                    <h1 className="text-xl font-bold uppercase">{user.name}</h1>
                    <p>MÓDULO DE VENDAS - PEDIDO DE VENDA</p>
                </div>
                <div className="text-right">
                    <p className="font-bold">NÚMERO: {sale.id.slice(-8).toUpperCase()}</p>
                    <p>DATA: {sale.createdAt?.toDate().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            <div className="border border-black p-4 mb-4 grid grid-cols-2 gap-4">
                <div>
                    <p className="font-bold">CLIENTE:</p>
                    <p>{client?.name || 'CONSUMIDOR FINAL'}</p>
                    <p>CPF/CNPJ: {client?.taxId || 'N/D'}</p>
                </div>
                <div>
                    <p className="font-bold">CONDIÇÃO DE PAGAMENTO:</p>
                    <p>{sale.paymentMethod.toUpperCase()}</p>
                    {sale.isInstallments && <p>PARCELAS: {sale.installmentsCount}X</p>}
                </div>
            </div>

            <table className="w-full border-collapse mb-4">
                <thead>
                    <tr className="border-y border-black uppercase bg-zinc-100">
                        <th className="p-2 border-x border-black text-left">Cód</th>
                        <th className="p-2 border-x border-black text-left flex-1">Descrição do Produto/Serviço</th>
                        <th className="p-2 border-x border-black text-center">Qtde</th>
                        <th className="p-2 border-x border-black text-right">Vlr Unit</th>
                        <th className="p-2 border-x border-black text-right">Desc</th>
                        <th className="px-2 py-2 border-x border-black text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items.map((it, i) => (
                        <tr key={i} className="border-b border-black">
                            <td className="p-2 border-x border-black">{it.id.slice(0, 5)}</td>
                            <td className="p-2 border-x border-black uppercase">{it.name}</td>
                            <td className="p-2 border-x border-black text-center">{it.quantity}</td>
                            <td className="p-2 border-x border-black text-right">{it.price.toFixed(2)}</td>
                            <td className="p-2 border-x border-black text-right">{(it.discount || 0).toFixed(2)}</td>
                            <td className="p-2 border-x border-black text-right">{(it.quantity * (it.price - (it.discount || 0))).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex justify-end">
                <div className="w-1/3 border border-black p-4 space-y-2 font-bold">
                    <div className="flex justify-between"><span>SUBTOTAL:</span> <span>R$ {sale.subtotal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>TOTAL DESC:</span> <span>R$ {sale.totalDiscount.toFixed(2)}</span></div>
                    <div className="flex justify-between text-lg border-t border-black pt-2"><span>TOTAL:</span> <span>R$ {sale.total.toFixed(2)}</span></div>
                </div>
            </div>
        </div>
    );

    const renderLaser = () => (
        <div className="w-[210mm] mx-auto bg-white text-zinc-900 p-12 font-sans shadow-2xl rounded-sm">
            <div className="flex justify-between items-start mb-12 pb-8 border-b-2 border-zinc-100">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center text-white text-2xl font-black">
                        {user.name.slice(0, 1)}
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter uppercase text-zinc-900">{user.name}</h1>
                        <p className="text-zinc-500 font-bold text-sm tracking-widest uppercase mt-1">Pedido de Venda #{sale.id.slice(-6).toUpperCase()}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h3 className="text-emerald-600 font-black text-2xl">R$ {sale.total.toFixed(2)}</h3>
                    <p className="text-zinc-400 text-xs font-bold uppercase mt-1 tracking-widest">{sale.createdAt?.toDate().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-12">
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] border-b border-zinc-100 pb-2">Destinatário</h4>
                    <div>
                        <p className="text-lg font-black text-zinc-800 uppercase">{client?.name || 'Consumidor Final'}</p>
                        <p className="text-zinc-500 text-sm font-medium mt-1">{client?.email || 'Sem email cadastrado'}</p>
                        <p className="text-zinc-500 text-sm font-medium">{client?.phone || 'Sem telefone'}</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] border-b border-zinc-100 pb-2">Pagamento</h4>
                    <div>
                        <p className="text-lg font-black text-zinc-800 uppercase">{sale.paymentMethod}</p>
                        {sale.isInstallments && (
                            <p className="text-purple-600 text-sm font-bold mt-1">Parcelado em {sale.installmentsCount}x</p>
                        )}
                        <p className="text-zinc-500 text-sm font-medium">Status: Pago/Recebido</p>
                    </div>
                </div>
            </div>

            <table className="w-full text-left mb-12">
                <thead>
                    <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                        <th className="py-4">Item Catalogado</th>
                        <th className="py-4 text-center">Qtde</th>
                        <th className="py-4 text-right">Preço Un.</th>
                        <th className="py-4 text-right">Desconto</th>
                        <th className="py-4 text-right pr-4">Subtotal</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                    {sale.items.map((it, i) => (
                        <tr key={i}>
                            <td className="py-6">
                                <p className="font-black text-zinc-800 uppercase text-sm">{it.name}</p>
                                <p className="text-[9px] text-zinc-400 font-bold tracking-widest mt-1">SKU: {it.id.slice(0, 10)}</p>
                            </td>
                            <td className="py-6 text-center font-bold text-zinc-600">{it.quantity}</td>
                            <td className="py-6 text-right font-bold text-zinc-600">R$ {it.price.toFixed(2)}</td>
                            <td className="py-6 text-right font-bold text-rose-500">R$ {(it.discount || 0).toFixed(2)}</td>
                            <td className="py-6 text-right font-black text-zinc-900 pr-4">R$ {((it.price - (it.discount || 0)) * it.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex justify-end pt-8 border-t border-zinc-100">
                <div className="w-[300px] space-y-4">
                    <div className="flex justify-between text-sm font-bold text-zinc-500 uppercase tracking-widest">
                        <span>Subtotal Bruto</span>
                        <span>R$ {sale.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-rose-500 uppercase tracking-widest">
                        <span>Total Descontos</span>
                        <span>- R$ {sale.totalDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-2xl font-black text-zinc-900 uppercase tracking-tighter pt-4 border-t-4 border-zinc-900">
                        <span>Total Líquido</span>
                        <span>R$ {sale.total.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col p-4 md:p-10 animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6 bg-background-card p-4 rounded-3xl border border-border shadow-2xl no-print">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-800 rounded-2xl border border-border text-zinc-400">
                        <ICONS.Printer className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Pré-visualização de Impressão</h3>
                </div>
                <div className="flex gap-3">
                    <button onClick={handlePrint} className="btn-premium-primary px-8">IMPRIMIR AGORA</button>
                    <button onClick={onClose} className="btn-premium-secondary px-8">FECHAR</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-zinc-950/20 rounded-[3rem] border border-white/5 shadow-inner print:p-0 print:bg-white print:border-none print:shadow-none print:overflow-visible">
                {type === 'THERMAL' && renderThermal()}
                {type === 'DOT_MATRIX' && renderDotMatrix()}
                {type === 'LASER' && renderLaser()}
            </div>

            <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-area { margin: 0; padding: 0; }
        }
      `}</style>
        </div>
    );
};

export default SalePrintPreview;
