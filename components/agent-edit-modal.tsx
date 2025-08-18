import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface AgentEditModalProps {
    open: boolean;
    agent: any;
    onClose: () => void;
    onSave: (updatedAgent: any) => void;
}

const calculationTypes = [
    "nonvat with invoice",
    "nonvat without invoice",
    "vat with invoice",
    "vat deduction",
];

const commissionTypes = [
    "COMM",
    "INCENTIVES",
    "COMM & INCENTIVES",
];

const percentOptions = Array.from({ length: 25 }, (_, i) => (i * 0.5).toFixed(1) + "%"); // 0% to 12%

function formatCurrencyInput(value: string) {
    // Remove non-numeric except dot
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) return "";
    // Split integer and decimal
    const [integer, decimal] = cleaned.split(".");
    const formattedInt = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decimal !== undefined ? `${formattedInt}.${decimal}` : formattedInt;
}

export function AgentEditModal({ open, agent, onClose, onSave }: AgentEditModalProps) {
    const [form, setForm] = useState(agent || {});

    useEffect(() => {
        setForm(agent || {});
    }, [agent]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        // Currency formatting for commission and net_of_vat
        if (name === "comm" || name === "net_of_vat") {
            setForm({ ...form, [name]: formatCurrencyInput(value) });
        } else {
            setForm({ ...form, [name]: value });
        }
    };

    const handleSave = () => {
        onSave(form);
    };

    if (!agent) return null;

    // Utility for section headings
    const SectionHeading = ({ children }: { children: React.ReactNode }) => (
        <div className="col-span-2 border-b border-blue-200 pb-1 mb-2 mt-6 text-lg font-semibold text-[#3c8dbc] tracking-wide">
            {children}
        </div>
    );

    // Utility for input fields
    const InputField = ({
        label,
        name,
        type = "text",
        disabled = false,
        children,
        ...props
    }: {
        label: string;
        name: string;
        type?: string;
        disabled?: boolean;
        children?: React.ReactNode;
        [key: string]: any;
    }) => (
        <div>
            <label className="block text-xs font-semibold text-[#001f3f] mb-1">{label}</label>
            {children ? (
                children
            ) : (
                <input
                    className={`w-full rounded border border-[#3c8dbc] px-2 py-1 text-[#001f3f] transition
                        ${disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white focus:outline-none focus:ring-2 focus:ring-[#3c8dbc]"}
                    `}
                    name={name}
                    type={type}
                    value={form[name] || ""}
                    onChange={handleChange}
                    disabled={disabled}
                    {...props}
                />
            )}
        </div>
    );

    // Utility for percent dropdowns
    const PercentDropdown = (name: string) => (
        <select
            className="w-full rounded border border-[#3c8dbc] px-2 py-1 text-[#001f3f] bg-white focus:outline-none focus:ring-2 focus:ring-[#3c8dbc] transition"
            name={name}
            value={form[name] || ""}
            onChange={handleChange}
        >
            <option value="">Select</option>
            {percentOptions.map((opt) => (
                <option key={opt} value={opt.replace("%", "")}>{opt}</option>
            ))}
        </select>
    );

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-white text-[#001f3f] max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-lg border border-[#3c8dbc]">
                <DialogHeader>
                    <DialogTitle className="text-2xl text-[#3c8dbc] font-bold mb-2">
                        Edit Agent: {agent.agent_name}
                    </DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={e => {
                        e.preventDefault();
                        handleSave();
                    }}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <SectionHeading>Commission Sale Details</SectionHeading>
                        <InputField label="Developer" name="developer" />
                        <InputField label="Client" name="client" disabled />
                        <InputField label="Commission" name="comm" type="text" />
                        <InputField label="Commission Type" name="comm_type">
                            <select
                                className="w-full rounded border border-[#3c8dbc] px-2 py-1 text-[#001f3f] bg-white focus:outline-none focus:ring-2 focus:ring-[#3c8dbc] transition"
                                name="comm_type"
                                value={form.comm_type || ""}
                                onChange={handleChange}
                            >
                                {commissionTypes.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </InputField>
                        <InputField label="Reservation Date" name="reservation_date" type="date" disabled />
                        <InputField label="Sales UUID" name="sales_uuid" />
                        <InputField label="Invoice Number" name="invoice_number" />

                        <SectionHeading>Agent Details</SectionHeading>
                        <InputField label="Agent Name" name="agent_name" />
                        <InputField label="BDO Account #" name="bdo_account" />
                        <InputField label="Net of VAT" name="net_of_vat" type="text" />
                        <InputField label="Status" name="status" />
                        <InputField label="Calculation Type" name="calculation_type">
                            <select
                                className="w-full rounded border border-[#3c8dbc] px-2 py-1 text-[#001f3f] bg-white focus:outline-none focus:ring-2 focus:ring-[#3c8dbc] transition"
                                name="calculation_type"
                                value={form.calculation_type || ""}
                                onChange={handleChange}
                            >
                                <option value="">Select</option>
                                {calculationTypes.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </InputField>
                        <InputField label="Agent's Rate (%)" name="agents_rate">
                            {PercentDropdown("agents_rate")}
                        </InputField>
                        <InputField label="Developer's Rate (%)" name="developers_rate">
                            {PercentDropdown("developers_rate")}
                        </InputField>
                        <InputField label="Agent Amount" name="agent_amount" type="number" step="0.01" />
                        <InputField label="Agent VAT" name="agent_vat" type="number" step="0.01" />
                        <InputField label="Agent EWT" name="agent_ewt" type="number" step="0.01" />
                        <InputField label="Agent EWT Rate (%)" name="agent_ewt_rate" type="number" step="0.01" />
                        <InputField label="Agent Net Commission" name="agent_net_comm" type="number" step="0.01" />

                        <SectionHeading>UM Details</SectionHeading>
                        <InputField label="UM Name" name="um_name" />
                        <InputField label="UM Calculation Type" name="um_calculation_type" />
                        <InputField label="UM Rate (%)" name="um_rate">
                            {PercentDropdown("um_rate")}
                        </InputField>
                        <InputField label="UM Developer's Rate (%)" name="um_developers_rate">
                            {PercentDropdown("um_developers_rate")}
                        </InputField>
                        <InputField label="UM Amount" name="um_amount" type="number" step="0.01" />
                        <InputField label="UM VAT" name="um_vat" type="number" step="0.01" />
                        <InputField label="UM EWT" name="um_ewt" type="number" step="0.01" />
                        <InputField label="UM EWT Rate (%)" name="um_ewt_rate" type="number" step="0.01" />
                        <InputField label="UM Net Commission" name="um_net_comm" type="number" step="0.01" />
                        <InputField label="UM BDO Account #" name="um_bdo_account" />

                        <SectionHeading>TL Details</SectionHeading>
                        <InputField label="TL Name" name="tl_name" />
                        <InputField label="TL Calculation Type" name="tl_calculation_type" />
                        <InputField label="TL Rate (%)" name="tl_rate">
                            {PercentDropdown("tl_rate")}
                        </InputField>
                        <InputField label="TL Developer's Rate (%)" name="tl_developers_rate">
                            {PercentDropdown("tl_developers_rate")}
                        </InputField>
                        <InputField label="TL Amount" name="tl_amount" type="number" step="0.01" />
                        <InputField label="TL VAT" name="tl_vat" type="number" step="0.01" />
                        <InputField label="TL EWT" name="tl_ewt" type="number" step="0.01" />
                        <InputField label="TL EWT Rate (%)" name="tl_ewt_rate" type="number" step="0.01" />
                        <InputField label="TL Net Commission" name="tl_net_comm" type="number" step="0.01" />
                        <InputField label="TL BDO Account #" name="tl_bdo_account" />

                        <SectionHeading>Remarks</SectionHeading>
                        <InputField label="Secretary Remarks" name="secretary_remarks" />
                        <InputField label="Accounting Remarks" name="accounting_remarks" />
                    </div>
                    <DialogFooter className="mt-8">
                        <Button variant="outline" className="bg-white text-[#3c8dbc] border-[#3c8dbc] hover:bg-[#3c8dbc] hover:text-white" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button className="bg-[#3c8dbc] text-white hover:bg-[#001f3f]" type="submit">
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}