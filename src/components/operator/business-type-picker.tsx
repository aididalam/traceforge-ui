"use client";
import CreatableSelect from "react-select/creatable";
import { components } from "react-select";
import type { InputProps, StylesConfig } from "react-select";

type BusinessType = { label: string; value: string };
const options: BusinessType[] = ["Producer", "Manufacturer", "Distributor", "Transport company", "Warehouse", "Retailer", "Importer", "Exporter", "Repair workshop", "Recycler"]
  .map(value => ({ label: value, value }));
const styles: StylesConfig<BusinessType, false> = {
  control: (base, state) => ({ ...base, minHeight: 46, borderRadius: 6,
    borderColor: state.isFocused ? "#6c757d" : "#adb5bd", backgroundColor: state.isDisabled ? "#e9ecef" : "#fff",
    boxShadow: state.isFocused ? "0 0 0 .2rem rgba(73,80,87,.18)" : "none", ":hover": { borderColor: "#6c757d" } }),
  valueContainer: base => ({ ...base, padding: "2px 12px" }),
  input: base => ({ ...base, color: "#212529" }),
  placeholder: base => ({ ...base, color: "#6c757d" }),
  singleValue: base => ({ ...base, color: "#212529" }),
  menu: base => ({ ...base, zIndex: 10, border: "1px solid #dee2e6" }),
  option: (base, state) => ({ ...base, minHeight: 44, padding: "10px 12px", overflowWrap: "anywhere",
    color: state.isSelected ? "#fff" : "#212529", backgroundColor: state.isSelected ? "#343a40" : state.isFocused ? "#f1f3f5" : "#fff",
    ":active": { backgroundColor: state.isSelected ? "#343a40" : "#e9ecef" } }),
};
function SearchInput(props: InputProps<BusinessType, false>) {
  return <components.Input {...props} maxLength={120}/>;
}

export function BusinessTypePicker({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <div>
    <div className="input-label">
      <label htmlFor="business-type">Business type</label>
      <CreatableSelect<BusinessType, false>
        inputId="business-type" instanceId="business-type-picker" name="businessType"
        className="business-type-picker" classNamePrefix="business-type" styles={styles}
        components={{ Input: SearchInput }} options={options} isDisabled={disabled} isClearable required
        value={value ? options.find(option => option.value === value) ?? { label: value, value } : null}
        onChange={option => onChange(option?.value ?? "")} onCreateOption={input => onChange(input.trim())}
        isValidNewOption={input => {
          const type = input.trim();
          return !!type && type.length <= 120 && !/[\x00-\x1f\x7f]/.test(input)
            && !options.some(option => option.value.toLowerCase() === type.toLowerCase())
            && type.toLowerCase() !== value.toLowerCase();
        }}
        formatCreateLabel={input => `Use “${input.trim()}”`}
        placeholder="Select a type or write your own" noOptionsMessage={() => "Type a business type to add your own."}
        aria-describedby="business-type-help"
      />
    </div>
    <p className="form-text" id="business-type-help">Choose a business type, or type your own and select “Use”. Your type does not limit who you can receive products from.</p>
  </div>;
}
