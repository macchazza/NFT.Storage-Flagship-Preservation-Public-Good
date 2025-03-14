"use client";
import FlexColumn from "@/_ui/flex/FlexColumn";
import React, { useEffect, useState } from "react";
import style from "@/styles/GlobalConstants";
import Text from "@/_ui/text/Text";
import FlexRow from "@/_ui/flex/FlexRow";
import ButtonNative from "@/_ui/buttons/ButtonNative";
import InputLabel from "@/_ui/input/InputLabel";
import useCollections from "@/hooks/useCollections";
import IconBase from "@/_ui/icons/IconBase";
import TableNative from "@/_ui/table/TableNative";
import Modal from "@/_ui/modal/Modal";
import Dropdown from "@/_ui/dropdown/Dropdown";
import { tokenUpload } from "@/services/ApiService";
import toast from "react-hot-toast";
import FileUpload from "@/_ui/fileUpload/FileUpload";
import Checkbox from "@/_ui/checkbox/Checkbox";

const Dashboard = () => {
  const [addToken, setAddToken] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [userAgree, setUserAgree] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [disable, setDisable] = useState<boolean>(false);
  const [isChecked, setIsChecked] = useState(false);

  const handleCheckboxChange = (isChecked: boolean) => {
    setIsChecked(isChecked);
  };

  const hookCollections = useCollections();

  useEffect(() => {
    hookCollections.fetchTokens();
  }, []);

  const openTokenModal = () => {
    setAddToken(true);
  };

  const closeTokenModal = () => {
    setAddToken(false);
    setUploadedFile(null);
    hookCollections.$loadCollectionNetwork("");
    hookCollections.$loadCollectionContractAddress("");
    handleCheckboxChange(false);
    setDisable(false);
  };
  const closeWarningModal = () => {
    setShowWarning(false);
  };

  const handleDropdownChange = (value: string) => {
    hookCollections.$loadCollectionNetwork(value);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) {
      toast.error("Please upload CSV file");
      setDisable(false);
      return;
    }

    let tempContractAddress = hookCollections.$collectionContractAddress;

    if (
      !tempContractAddress &&
      hookCollections.$collectionNetwork !== "solana"
    ) {
      toast.error("Please enter contract address");
      setDisable(false);
      return;
    }
    if (
      hookCollections.$collectionNetwork === "solana" &&
      !tempContractAddress
    ) {
      tempContractAddress = "undefined";
      hookCollections.$loadCollectionContractAddress(tempContractAddress);
    }
    if (file.type === "text/csv" || file.type === "application/json") {
      try {
        let cids = new Set();
        let duplicateCids = new Set();

        if (file.type === "text/csv") {
          const text = await file.text();
          const rows = text.split("\n");
          rows.forEach((row, index) => {
            if (index > 0 && row.trim() !== "") {
              // Skip header row
              const columns = row.split(",");
              const cid = columns[1].trim();
              if (cids.has(cid)) {
                duplicateCids.add(cid);
              } else {
                cids.add(cid);
              }
            }
          });
        } else if (file.type === "application/json") {
          const text = await file.text();
          const json = JSON.parse(text);
          json.forEach((item: any) => {
            const cid = item.cid.trim();
            if (cids.has(cid)) {
              duplicateCids.add(cid);
            } else {
              cids.add(cid);
            }
          });
        }

        if (duplicateCids.size > 0) {
          if (!userAgree) {
            setShowWarning(true);
            setDisable(false);
            return;
          }
        }
        const userCollections = await hookCollections.fetchCollections();
        const collection = userCollections.find(
          (item: any) => item.contractAddress == tempContractAddress
        );
        if (userCollections.length === 0 || !collection) {
          const resPromise = hookCollections.newCollection(tempContractAddress);
          toast.promise(resPromise, {
            loading: "Creating new collection...",
            success: "New collection created successfully",
            error: "Error creating new collection",
          });

          const res = await resPromise;
          if (res) {
            const collectionNew = await hookCollections.fetchCollections();
            const formData = new FormData();
            formData.append("file", file);
            formData.append(
              "collectionID",
              collectionNew.length == 1
                ? collectionNew[0].collectionID
                : collectionNew.find(
                    (item: any) => item.contractAddress == tempContractAddress
                  ).collectionID
            );
            formData.append("network", hookCollections.$collectionNetwork);
            // await toast.promise(
            //   tokenUpload(formData),
            //   {
            //     loading: "Uploading tokens...",
            //     success: (response: any) => {
            //       if (response.ok == true) {
            //         return response.value;
            //       } else {
            //         return response.error.message;
            //       }
            //     },
            //     error: "Error uploading tokens 1",
            //   },
            //   { duration: 5000 }
            // );
            toast.loading("Uploading tokens...");
            const response = await tokenUpload(formData);
            if (response.ok) {
              toast.dismiss();
              toast.success(response.value, {
                duration: 4000,
              });
            } else {
              toast.dismiss();
              toast.error(response.error.message, {
                duration: 4000,
              });
            }
            closeTokenModal();
            await hookCollections.fetchTokens();
          }
        } else {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("collectionID", collection.collectionID);
          formData.append("network", hookCollections.$collectionNetwork);
          toast.loading("Uploading tokens...");
          const response = await tokenUpload(formData);

          if (response.ok) {
            toast.dismiss();
            toast.success(response.value, {
              duration: 4000,
            });
          } else {
            toast.dismiss();
            toast.error(response.error.message, {
              duration: 4000,
            });
          }
          // await toast.promise(
          //   tokenUpload(formData),
          //   {
          //     loading: "Uploading tokens...",
          //     success: (response: any) => {
          //       console.log(response);
          //       if (response.ok == true) {
          //         return response.value;
          //       } else {
          //         return response.error.message;
          //       }
          //     },
          //     error: "Error uploading tokens 2",
          //   },
          //   { duration: 5000 }
          // );
          closeTokenModal();
          await hookCollections.fetchTokens();
        }
        setUploadedFile(null);
        hookCollections.$loadCollectionNetwork("");
        hookCollections.$loadCollectionContractAddress("");
        handleCheckboxChange(false);
        setDisable(false);
      } catch (error) {
        console.log("error", error);
        toast.error("Error handling file upload");
      }
    } else {
      toast.error("Please upload a CSV file.");
    }
  };

  const onFileUpload = async (file: File) => {
    setUploadedFile(file);
  };

  const getTooltipContent = () => {
    if (hookCollections.$collectionNetwork === "solana") {
      return (
        <>
          Only CSVs are accepted.
          <br /> Header row must be: tokenAddress, cid
          <br />
          Each row must include a tokenAddress and cid match in separate columns
        </>
      );
    }
    return (
      <>
        Only CSVs are accepted.
        <br /> Header row must be: tokenID, cid
        <br />
        Each row must include a tokenID and cid match in separate columns
      </>
    );
  };

  const columnsdashboard: any = [
    { key: "createdAt", header: "Date" },
    { key: "cid", header: "CID" },
    { key: "tokenID", header: "Token ID" },
    { key: "filecoinDeal", header: "Filecoin Deal" },
    { key: "dealStatus", header: "Deal Status" },
    { key: "fileSize", header: "File Size" },
  ];

  const options = [
    { value: "eth", label: "Ethereum", icon: <IconBase slug="logo-eth" /> },
    {
      value: "solana",
      label: "Solana",
      icon: <IconBase slug="logo-solana" />,
    },
    {
      value: "algorand",
      label: "Algorand",
      icon: <IconBase slug="logo-algorand" />,
    },
    {
      value: "arbitrum",
      label: "Arbitrum",
      icon: <IconBase slug="logo-arbitrum" />,
    },
    {
      value: "avalanch",
      label: "Avalanch",
      icon: <IconBase slug="logo-avalanche" />,
    },
    { value: "base", label: "Base", icon: <IconBase slug="logo-base" /> },
    {
      value: "cardano",
      label: "Cardano",
      icon: <IconBase slug="logo-cardano" />,
    },
    {
      value: "filecoin",
      label: "Filecoin Mainnet",
      icon: <IconBase slug="logo-filecoin" />,
    },
    {
      value: "flow",
      label: "Flow",
      icon: <IconBase slug="logo-flow" />,
    },
    {
      value: "immutable",
      label: "Immutable",
      icon: <IconBase slug="logo-immutable" />,
    },
    {
      value: "optimism",
      label: "Optimism",
      icon: <IconBase slug="logo-optimism" />,
    },
    {
      value: "polygon",
      label: "Polygon",
      icon: <IconBase slug="logo-polygon" />,
    },
    {
      value: "rari",
      label: "RARI Chain",
      icon: <IconBase slug="logo-rari" />,
    },
    {
      value: "stargaze",
      label: "Stargaze",
      icon: <IconBase slug="logo-stargaze" />,
    },
    {
      value: "tezos",
      label: "Tezos",
      icon: <IconBase slug="logo-tezos" />,
    },
    {
      value: "zksync",
      label: "zkSync",
      icon: <IconBase slug="logo-zksync" />,
    },
    {
      value: "zora",
      label: "Zora",
      icon: <IconBase slug="logo-zora" />,
    },
  ];
  return (
    <>
      <div
        style={{
          width: "100%",
          // padding: "2.5rem 0 0 0",
          // height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: `${style.color.secondary}`,
        }}
      >
        <FlexColumn>
          <div
            style={{
              borderBottom: "1px solid black ",
              width: "100%",
              height: "fit-content",
            }}
          >
            <FlexColumn
              padding="1.5rem "
              vrAlign="flex-start"
              height="fit-content"
              hrAlign="flex-start"
            >
              <FlexRow width="fit-content" marginBottom={"xs"}>
                <Text
                  fontSize={style.font.h3}
                  marginRight={style.margin.xxs}
                  fontFamily="ChicagoFLF"
                >
                  Files
                </Text>
                <div
                  style={{
                    background: style.color.lightSecondry,
                    border: "1px solid #F5C32C",
                    padding: style.padding.xxxs,
                  }}
                >
                  <Text fontSize={style.font.h6}>
                    {hookCollections.$userTokens.length
                      ? hookCollections.$userTokens.length
                      : "0"}
                  </Text>
                </div>
              </FlexRow>

              <FlexRow hrAlign="space-between">
                <FlexRow width="fit-content">
                  <InputLabel
                    placeholder="Search by CID..."
                    marginRight={style.margin.xs}
                    searchIcon={true}
                    inputValue={hookCollections.$cidSearch}
                    onChange={(e: any) => {
                      let searchValue = e.target.value;
                      hookCollections.$loadCidSearch(searchValue);
                      const filtered = hookCollections.$userTokens.filter(
                        (item: any) =>
                          item.cid
                            .toLowerCase()
                            .includes(searchValue.toLowerCase())
                      );
                      hookCollections.setFilteredData(filtered);
                    }}
                  />
                  <ButtonNative
                    text="Filters"
                    width="100px"
                    hrAlign={"center"}
                    // paddingBottom="9px"
                    // paddingTop="9px"
                    iconLeft={{ slug: "icon-filter" }}
                    borderColor="#000"
                  />
                </FlexRow>
                {hookCollections.$userTokens.length ? (
                  <ButtonNative
                    onClick={openTokenModal}
                    variant="dark"
                    width="fit-content"
                    text="Add items"
                    iconLeft={{ slug: "icon-plus" }}
                  />
                ) : (
                  <></>
                )}
              </FlexRow>
            </FlexColumn>
          </div>

          {hookCollections.isLoading ? (
            <FlexColumn>
              <IconBase slug="spining-loader" size="3xl" />
            </FlexColumn>
          ) : (
            <>
              {hookCollections.filteredData.length ? (
                <FlexColumn hrAlign="flex-start">
                  <TableNative
                    data={hookCollections.filteredData}
                    columns={columnsdashboard}
                  />
                </FlexColumn>
              ) : (
                <FlexColumn width="fit-content">
                  <IconBase slug="icon-noToken" size="5xl" />
                  <Text
                    align="center"
                    fontSize={style.font.h3}
                    marginTop={style.margin.sm}
                    marginBottom={style.margin.sm}
                    fontWeight={600}
                    fontFamily="ChicagoFLF"
                  >
                    Upload your first item!
                  </Text>
                  <Text
                    align="center"
                    marginBottom={style.margin.sm}
                    fontSize={style.font.h7}
                  >
                    Add a contract ID, select a network and <br /> upload a
                    CID/Token ID match csv.
                  </Text>
                  <ButtonNative
                    iconLeft={{ slug: "icon-plus" }}
                    text="Add items"
                    onClick={() => {
                      // if (hookUserApi.$dataLimit == 0) {
                      //   toast("please buy datacap before uploading");
                      // } else {
                      openTokenModal();
                      // }
                    }}
                    variant="dark"
                    width="fit-content"
                  ></ButtonNative>
                </FlexColumn>
              )}
            </>
          )}
        </FlexColumn>
      </div>

      <Modal
        isOpen={addToken}
        onClose={closeTokenModal}
        size="md"
        body={
          <>
            <FlexColumn>
              <Text
                fontSize={style.font.h4}
                fontFamily="ChicagoFLF"
                marginBottom={style.margin.xs}
              >
                Upload Item(s)
              </Text>

              <InputLabel
                placeholder={
                  hookCollections.$collectionNetwork == "solana"
                    ? "Verified Collection Address (Optional)"
                    : "Contract Address"
                }
                inputValue={hookCollections?.$collectionContractAddress}
                width="100%"
                marginBottom={style.margin.sm}
                onChange={(e: any) => {
                  let collectionContractAddress = e.target.value;
                  hookCollections.$loadCollectionContractAddress(
                    collectionContractAddress
                  );
                }}
              />
              <Dropdown
                placeholdericon={<IconBase slug="icon-chain" />}
                options={options}
                value={hookCollections.$collectionNetwork}
                onChange={handleDropdownChange}
                placeholder="Please select your chain"
                isDisabled={false}
                size="md"
                backgroundColor="white"
              />
              <FlexRow marginTop={"sm"}>
                {!uploadedFile && <FileUpload onFileUpload={onFileUpload} />}
                {uploadedFile && (
                  <div
                    style={{
                      border: "1px dashed black",
                      // height: "100px",
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px",
                      background: "#C6E6F3",
                    }}
                  >
                    <p
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      {uploadedFile.name} (
                      {(uploadedFile.size / 1024).toFixed(2)} KB)
                      <ButtonNative
                        variant="transparent"
                        width="fit-content"
                        onClick={handleRemoveFile}
                      >
                        <IconBase slug="icon-chevron-close" />
                      </ButtonNative>
                    </p>
                  </div>
                )}
              </FlexRow>
              <FlexRow hrAlign="flex-start" marginTop={"sm"}>
                File supported: CSV
              </FlexRow>
              <FlexRow hrAlign="flex-start" marginTop={"sm"}>
                <Checkbox checked={isChecked} onChange={handleCheckboxChange}>
                  <div style={{ width: "90%" }}>
                    <Text>
                      By submitting this file, I certify that I own the
                      copyright or have obtained the necessary permissions to
                      upload it to NFT.Storage.
                    </Text>
                  </div>
                </Checkbox>
              </FlexRow>
            </FlexColumn>
          </>
        }
        footer={
          <FlexRow hrAlign="space-between">
            <div style={{ position: "relative" }} className="tooltipParent">
              <FlexRow width="fit-content">
                <IconBase slug="icon-info" />
                <Text marginLeft={style.margin.xxs}>What should I upload?</Text>
                {hookCollections.$collectionNetwork !== "solana" ? (
                  <div className="tooltip">
                    Only CSVs are accepted.
                    <br /> Header row must be: tokenID, cid <br />
                    Each row must include a tokenID and cid match in seperate
                    columns
                  </div>
                ) : (
                  <div className="tooltip">
                    Only CSVs are accepted.
                    <br /> Header row must be: tokenAddress, cid <br />
                    Each row must include a tokenAddress and cid match in
                    seperate columns
                  </div>
                )}
              </FlexRow>
            </div>
            <div>
              <ButtonNative
                // variant="dark"
                marginRight="sm"
                onClick={closeTokenModal}
                width="100px"
              >
                Cancel
              </ButtonNative>

              <ButtonNative
                disabled={disable || !isChecked}
                variant="dark"
                onClick={() => {
                  setDisable(true);
                  handleFileUpload(uploadedFile);
                  setUserAgree(false);
                }}
                width="100px"
              >
                Upload
              </ButtonNative>
            </div>
          </FlexRow>
        }
      />
      <Modal
        isOpen={showWarning}
        onClose={closeWarningModal}
        size="md"
        body={
          <>
            <ul>
              <li>
                This file contains duplicate CIDs and data cap usage is
                calculated separately for each instance.
              </li>
              <li>
                Duplicate CID means double data cap consumption for the same
                usage.
              </li>
              <li>
                You can specify the token numbers as a range(like: Qm....,
                1-999) in such cases.
              </li>
            </ul>
          </>
        }
        footer={
          <FlexRow hrAlign="center">
            <div>
              <ButtonNative
                marginRight="sm"
                onClick={() => {
                  closeWarningModal();
                  closeTokenModal();
                }}
                width="100px"
              >
                Cancel
              </ButtonNative>

              <ButtonNative
                variant="dark"
                onClick={() => {
                  setShowWarning(false);
                  setUserAgree(true);
                }}
                width="100px"
              >
                OK
              </ButtonNative>
            </div>
          </FlexRow>
        }
      />
    </>
  );
};

export default Dashboard;
