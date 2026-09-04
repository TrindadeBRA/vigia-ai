// Gera o payload estático do Pix ("copia e cola") no formato BR Code / EMV,
// seguindo o manual do Bacen (ID-Length-Value). CRC16-CCITT sempre por último.

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(COMBINING_DIACRITICS, "");
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type PixPayloadInput = {
  key: string;
  name: string;
  city: string;
  amount?: number | null;
  description?: string;
  txid?: string;
};

export function buildPixPayload({ key, name, city, amount, description, txid }: PixPayloadInput): string {
  const merchantName = stripAccents(name).toUpperCase().slice(0, 25);
  const merchantCity = stripAccents(city).toUpperCase().slice(0, 15);
  const id = (txid || "***").replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***";

  const gui = tlv("00", "br.gov.bcb.pix");
  const pixKey = tlv("01", key);
  const desc = description ? tlv("02", stripAccents(description).slice(0, 40)) : "";
  const merchantAccountInfo = tlv("26", gui + pixKey + desc);

  const additionalData = tlv("62", tlv("05", id));

  const amountField = amount && amount > 0 ? tlv("54", amount.toFixed(2)) : "";

  const body =
    tlv("00", "01") +
    merchantAccountInfo +
    tlv("52", "0000") +
    tlv("53", "986") +
    amountField +
    tlv("58", "BR") +
    tlv("59", merchantName) +
    tlv("60", merchantCity) +
    additionalData;

  const withCrcId = `${body}6304`;
  return `${withCrcId}${crc16(withCrcId)}`;
}
